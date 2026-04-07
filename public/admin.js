const ADMIN_USER = 'eddie';
const ADMIN_PASS = 'randhawaeddie0025';
const SESSION_KEY = 'blacklight_admin_session';

let editingBlogId = null;

document.addEventListener("DOMContentLoaded", () => {
    checkLocalSession();
    initFileUploadListener();
});

function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
        v.style.display = 'none';
    });
    const target = document.getElementById(viewId + '-view');
    target.classList.add('active');
    target.style.display = 'block';
    
    if (viewId === 'dashboard') {
        initHub();
    }
}

function checkLocalSession() {
    const session = localStorage.getItem(SESSION_KEY);
    if (session === ADMIN_USER) {
        showView('dashboard');
    } else {
        showView('login');
    }
}

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('admin-user').value;
    const pass = document.getElementById('admin-pass').value;
    
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
        localStorage.setItem(SESSION_KEY, ADMIN_USER);
        showToast("Authenticated successfully");
        showView('dashboard');
    } else {
        showToast("Invalid credentials");
    }
});

function handleLogout() {
    localStorage.removeItem(SESSION_KEY);
    showView('login');
    showToast("Logged out");
}

function initFileUploadListener() {
    const fileInput = document.getElementById('new-blog-file');
    const label = document.getElementById('file-name-label');
    if (fileInput && label) {
        fileInput.addEventListener('change', (e) => {
            const fileName = e.target.files[0]?.name || "No file chosen";
            label.innerText = fileName;
        });
    }

    const docxInput = document.getElementById('docx-upload');
    if (docxInput) {
        docxInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            showToast("Extracting document...");
            const reader = new FileReader();
            reader.onload = function(event) {
                const arrayBuffer = event.target.result;
                mammoth.convertToHtml({arrayBuffer: arrayBuffer})
                    .then(function(result) {
                        const html = result.value;
                        document.getElementById('new-blog-content').value = html;
                        showToast("Word Document successfully converted to HTML!");
                        docxInput.value = ''; // Reset input to allow re-upload
                    })
                    .catch(function(err) {
                        console.error(err);
                        showToast("Error extracting Word document.");
                    });
            };
            reader.onerror = () => showToast("Error reading file.");
            reader.readAsArrayBuffer(file);
        });
    }
}

/* ================== INTELLIGENCE HUB LOGIC ================== */

function switchTab(tabId) {
    document.querySelectorAll('.sidebar-btn').forEach(btn => btn.classList.remove('active'));
    // Find the correct button by text content (approximate)
    const activeBtn = Array.from(document.querySelectorAll('.sidebar-btn')).find(b => b.innerText.toLowerCase().includes(tabId));
    if (activeBtn) activeBtn.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.getElementById('tab-' + tabId).style.display = 'block';
    
    if (tabId === 'articles') fetchHubArticles();
    if (tabId === 'archive') fetchArchivedArticles();
    if (tabId === 'comments') fetchHubComments();
    if (tabId === 'subscribers') fetchHubSubscribers();
    if (tabId === 'analytics') fetchHubStats();
}

async function initHub() {
    await fetchHubStats();
}

async function fetchHubStats() {
    try {
        const { data: stats } = await supabase.from('analytics').select('*').order('view_date', { ascending: false }).limit(7);
        const { count: subCount } = await supabase.from('subscribers').select('*', { count: 'exact', head: true });
        
        let totalViews = 0;
        stats?.forEach(s => totalViews += s.views);
        
        document.getElementById('stat-views').innerText = totalViews || 0;
        document.getElementById('stat-subs').innerText = subCount || 0;
        
        renderTrafficChart(stats || []);
    } catch (e) {
        console.error(e);
    }
}

function renderTrafficChart(stats) {
    const chart = document.getElementById('traffic-chart');
    if (!chart) return;
    chart.innerHTML = '';
    
    const days = ['S','M','T','W','T','F','S'];
    const dataPoints = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const stat = stats.find(s => s.view_date === dateStr);
        dataPoints.push({
            views: stat ? stat.views : 0,
            initial: days[d.getDay()],
            isToday: i === 0
        });
    }
    
    const maxViews = Math.max(...dataPoints.map(d => d.views), 10);
    
    dataPoints.forEach(pt => {
        const height = (pt.views / maxViews) * 100;
        const bar = document.createElement('div');
        bar.style.width = '30px';
        bar.style.height = `${Math.max(height, 5)}%`;
        bar.style.background = 'var(--accent)';
        bar.style.borderRadius = '4px 4px 0 0';
        bar.style.transition = 'height 1s ease-out';
        bar.style.position = 'relative';
        bar.title = `${pt.views} Views`;
        
        if (!pt.isToday) {
            bar.style.opacity = '0.4';
        } else {
            bar.style.boxShadow = '0 0 20px var(--accent-glow)';
        }
        
        chart.appendChild(bar);
    });
}

async function fetchHubArticles() {
    const list = document.getElementById('admin-articles-list');
    list.innerHTML = '<tr><td colspan="4">Loading Reports...</td></tr>';
    
    try {
        const { data: blogs, error } = await supabase
            .from('blogs')
            .select('*')
            .eq('is_archived', false)
            .order('id', { ascending: false });
            
        if (error) throw error;
        
        list.innerHTML = '';
        blogs.forEach(b => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${b.title}</strong></td>
                <td><span class="status-badge">${b.category}</span></td>
                <td>👍 ${b.likes} | 👎 ${b.dislikes}</td>
                <td style="display: flex; gap: 0.5rem;">
                    <button class="status-badge" style="background: rgba(var(--accent-rgb), 0.1); border: 1px solid var(--accent); cursor: pointer;" onclick="editHubArticle(${b.id})">Edit</button>
                    <button class="status-badge" style="background: rgba(255,255,255,0.05); color: #888; border: 1px solid #444; cursor: pointer;" onclick="archiveHubArticle(${b.id})">Archive</button>
                    <button class="delete-action" onclick="deleteHubArticle(${b.id})">Delete</button>
                </td>
            `;
            list.appendChild(row);
        });
    } catch (e) {
        showToast("Error loading articles");
    }
}

async function fetchArchivedArticles() {
    const list = document.getElementById('admin-archive-list');
    list.innerHTML = '<tr><td colspan="2">Loading Vault...</td></tr>';
    
    try {
        const { data: blogs, error } = await supabase
            .from('blogs')
            .select('*')
            .eq('is_archived', true)
            .order('id', { ascending: false });
            
        if (error) throw error;
        
        list.innerHTML = '';
        blogs.forEach(b => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${b.title}</strong></td>
                <td style="display: flex; gap: 0.5rem;">
                    <button class="status-badge" style="background: var(--accent); color: white; cursor: pointer;" onclick="reviveHubArticle(${b.id})">Revive</button>
                    <button class="delete-action" onclick="deleteHubArticle(${b.id})">Delete Permanently</button>
                </td>
            `;
            list.appendChild(row);
        });
    } catch (e) {
        showToast("Error loading vault");
    }
}

async function fetchHubComments() {
    const list = document.getElementById('admin-comments-list');
    list.innerHTML = '<tr><td colspan="4">Loading Engagements...</td></tr>';
    
    try {
        const { data: comments, error } = await supabase.from('comments').select('*').order('id', { ascending: false });
        if (error) throw error;
        
        list.innerHTML = '';
        comments.forEach(c => {
            const date = new Date(c.created_at).toLocaleDateString();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${c.name}</td>
                <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.text}</td>
                <td>${date}</td>
                <td><button class="delete-action" onclick="deleteHubComment(${c.id})">Delete</button></td>
            `;
            list.appendChild(row);
        });
    } catch (e) {
        showToast("Error loading comments");
    }
}

async function fetchHubSubscribers() {
    const list = document.getElementById('admin-subs-list');
    list.innerHTML = '<tr><td colspan="2">Loading Network...</td></tr>';
    
    try {
        const { data: subs, error } = await supabase.from('subscribers').select('*').order('id', { ascending: false });
        if (error) throw error;
        
        list.innerHTML = '';
        subs.forEach(s => {
            const date = new Date(s.created_at).toLocaleDateString();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${s.email}</td>
                <td>${date}</td>
            `;
            list.appendChild(row);
        });
    } catch (e) {
        showToast("Error loading subscribers");
    }
}

async function editHubArticle(id) {
    editingBlogId = id;
    try {
        const { data: blog, error } = await supabase.from('blogs').select('*').eq('id', id).single();
        if (error) throw error;
        
        document.getElementById('new-blog-title').value = blog.title;
        document.getElementById('new-blog-category').value = blog.category;
        document.getElementById('new-blog-author').value = blog.author;
        document.getElementById('new-blog-image').value = blog.cover_image;
        document.getElementById('new-blog-content').value = blog.content;
        
        document.getElementById('publish-btn').innerText = "Update Intelligence Report";
        document.getElementById('cancel-edit-btn').style.display = 'block';
        
        switchTab('publish');
        showToast("Loading report for editing...");
    } catch (e) {
        showToast("Failed to load article for editing");
    }
}

function cancelEditing() {
    editingBlogId = null;
    document.getElementById('upload-form').reset();
    document.getElementById('publish-btn').innerText = "Publish to Intelligence Feed";
    document.getElementById('cancel-edit-btn').style.display = 'none';
    document.getElementById('file-name-label').innerText = "No file chosen";
}

async function archiveHubArticle(id) {
    try {
        const { error } = await supabase.from('blogs').update({ is_archived: true }).eq('id', id);
        if (error) throw error;
        showToast("Report moved to Security Vault");
        fetchHubArticles();
    } catch (e) {
        showToast("Archive failed: " + e.message);
    }
}

async function reviveHubArticle(id) {
    try {
        const { error } = await supabase.from('blogs').update({ is_archived: false }).eq('id', id);
        if (error) throw error;
        showToast("Report restored to Public Feed");
        fetchArchivedArticles();
    } catch (e) {
        showToast("Revival failed: " + e.message);
    }
}

async function deleteHubArticle(id) {
    if (!confirm("Are you sure? This report will be permanently removed from the public feed.")) return;
    try {
        const { error } = await supabase.from('blogs').delete().eq('id', id);
        if (error) throw error;
        showToast("Article deleted successfully");
        fetchHubArticles();
        fetchArchivedArticles();
        fetchHubStats();
    } catch (e) {
        showToast("Delete failed: " + e.message);
    }
}

async function deleteHubComment(id) {
    if (!confirm("Delete this engagement?")) return;
    try {
        const { error } = await supabase.from('comments').delete().eq('id', id);
        if (error) throw error;
        showToast("Comment removed");
        fetchHubComments();
    } catch (e) {
        showToast("Delete failed: " + e.message);
    }
}

/* ================== PUBLISH / UPDATE LOGIC ================== */

document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const publishBtn = document.getElementById('publish-btn');
    publishBtn.disabled = true;
    publishBtn.innerText = editingBlogId ? "⚡ Updating Intelligence..." : "⚡ Uploading Intelligence...";

    const title = document.getElementById('new-blog-title').value;
    const category = document.getElementById('new-blog-category').value;
    const author = document.getElementById('new-blog-author').value;
    let cover_image = document.getElementById('new-blog-image').value;
    const fileInput = document.getElementById('new-blog-file');
    let content = document.getElementById('new-blog-content').value;
    
    try {
        if (fileInput && fileInput.files[0]) {
            const file = fileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
            const filePath = `covers/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('blog-covers')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from('blog-covers')
                .getPublicUrl(filePath);
            
            cover_image = publicUrlData.publicUrl;
        }

        if (content.indexOf('<p>') === -1 && content.indexOf('<h') === -1) {
            var lines = content.split('\n');
            var formatted = '';
            for (var i = 0; i < lines.length; i++) {
                if (lines[i].trim() !== '') formatted += '<p>' + lines[i] + '</p>';
            }
            content = formatted;
        }

        const tempElement = content.replace(/<[^>]+>/g, '');
        const excerpt = tempElement.substring(0, 150) + (tempElement.length > 150 ? '...' : '');

        const payload = {
            title,
            category,
            author: author || 'Admin',
            cover_image: cover_image || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
            content,
            excerpt,
            is_archived: false
        };

        if (editingBlogId) {
            const { error } = await supabase.from('blogs').update(payload).eq('id', editingBlogId);
            if (error) throw error;
            showToast("Report updated successfully!");
        } else {
            const { error } = await supabase.from('blogs').insert([payload]);
            if (error) throw error;
            showToast("New report published!");
        }
        
        cancelEditing();
        switchTab('articles');
    } catch(err) {
        showToast("Action failed: " + err.message);
    } finally {
        publishBtn.disabled = false;
        publishBtn.innerText = editingBlogId ? "Update Intelligence Report" : "Publish to Intelligence Feed";
    }
});
