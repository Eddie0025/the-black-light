let editingBlogId = null;
let authReady = false;
const SITE_ORIGIN = 'https://theblacklight.blog';

function slugify(text) {
    return (text || '')
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

function stripHtml(html) {
    return (html || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
}

function buildArticlePath(id, title) {
    if (!id) return '';
    const slug = slugify(title) || 'article';
    return `/article/${id}-${slug}`;
}

function buildCanonicalUrl(id, title) {
    const path = buildArticlePath(id, title);
    return path ? `${SITE_ORIGIN}${path}` : '';
}

function normalizeCanonicalOverride(value) {
    const trimmed = (value || '').trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('/')) return `${SITE_ORIGIN}${trimmed}`;
    return `https://${trimmed.replace(/^\/+/, '')}`;
}

function switchEditorTab(tabId) {
    document.querySelectorAll('.editor-tab-panel').forEach(panel => panel.classList.remove('active'));
    document.querySelectorAll('.editor-tab-btn').forEach(btn => btn.classList.remove('active'));

    const panel = document.getElementById(`editor-tab-${tabId}`);
    if (panel) panel.classList.add('active');

    document.querySelectorAll(`.editor-tab-btn[data-editor-tab="${tabId}"]`).forEach(btn => btn.classList.add('active'));
}

function updateSeoCounters() {
    const seoTitle = document.getElementById('seo-title');
    const seoDescription = document.getElementById('seo-description');
    const titleCount = document.getElementById('seo-title-count');
    const descriptionCount = document.getElementById('seo-description-count');

    if (titleCount) {
        titleCount.innerText = `${seoTitle?.value.length || 0} / 60`;
    }

    if (descriptionCount) {
        descriptionCount.innerText = `${seoDescription?.value.length || 0} / 160`;
    }
}

function refreshSeoPreview() {
    const title = document.getElementById('new-blog-title')?.value || '';
    const previewField = document.getElementById('seo-canonical-preview');
    const previewNote = document.getElementById('seo-canonical-note');
    const overrideValue = normalizeCanonicalOverride(document.getElementById('seo-canonical-override')?.value || '');
    const generatedCanonical = buildCanonicalUrl(editingBlogId, title);

    if (previewField) {
        previewField.value = overrideValue || generatedCanonical || '';
    }

    if (previewNote) {
        if (overrideValue) {
            previewNote.innerText = 'Manual override is active for this article.';
        } else if (generatedCanonical) {
            previewNote.innerText = 'This article will use its generated article URL automatically.';
        } else {
            previewNote.innerText = 'Canonical URL will be generated automatically after the article is first published.';
        }
    }
}

function bindSeoInputs() {
    const titleInput = document.getElementById('new-blog-title');
    const overrideInput = document.getElementById('seo-canonical-override');
    const seoTitleInput = document.getElementById('seo-title');
    const seoDescriptionInput = document.getElementById('seo-description');

    if (titleInput) titleInput.addEventListener('input', refreshSeoPreview);
    if (overrideInput) overrideInput.addEventListener('input', refreshSeoPreview);
    if (seoTitleInput) seoTitleInput.addEventListener('input', updateSeoCounters);
    if (seoDescriptionInput) seoDescriptionInput.addEventListener('input', updateSeoCounters);
}

function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

function toggleWorkspaceSize() {
    const textarea = document.getElementById('new-blog-content');
    textarea.classList.toggle('compact-view');
    autoResize(textarea);
}

document.addEventListener("DOMContentLoaded", () => {
    initializeAdminAuth();
    initFileUploadListener();
    bindSeoInputs();
    updateSeoCounters();
    refreshSeoPreview();
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

async function initializeAdminAuth() {
    try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        authReady = true;
        updateAuthView(data.session);

        supabase.auth.onAuthStateChange((_event, session) => {
            authReady = true;
            updateAuthView(session);
        });
    } catch (error) {
        console.error(error);
        showToast("Unable to verify admin session");
        showView('login');
    }
}

function updateAuthView(session) {
    if (session) {
        showView('dashboard');
    } else {
        showView('login');
    }
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!authReady) {
        showToast("Checking authentication status...");
        return;
    }

    const email = document.getElementById('admin-user').value.trim();
    const password = document.getElementById('admin-pass').value;
    const submitButton = e.currentTarget.querySelector('button[type="submit"]');

    submitButton.disabled = true;
    submitButton.innerText = "Authenticating...";

    try {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        showToast("Authenticated successfully");
        showView('dashboard');
        e.currentTarget.reset();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Invalid credentials");
    } finally {
        submitButton.disabled = false;
        submitButton.innerText = "Enter Vault";
    }
});

async function handleLogout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        showToast("Logged out");
        showView('login');
    } catch (error) {
        console.error(error);
        showToast("Logout failed");
    }
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

            const ext = file.name.split('.').pop().toLowerCase();
            
            if (ext === 'docx') {
                handleDocxImport(file, docxInput);
            } else if (ext === 'pdf') {
                handlePdfImport(file, docxInput);
            } else {
                showToast("Unsupported file format. Please use .docx or .pdf");
            }
        });
    }
}

function handleDocxImport(file, inputEl) {
    showToast("Extracting Word document...");
    const reader = new FileReader();
    reader.onload = function(event) {
        const arrayBuffer = event.target.result;
        
        // Use mammoth with style mapping to preserve formatting
        mammoth.convertToHtml({arrayBuffer: arrayBuffer}, {
            styleMap: [
                "p[style-name='Heading 1'] => h1:fresh",
                "p[style-name='Heading 2'] => h2:fresh",
                "p[style-name='Heading 3'] => h3:fresh",
            ]
        })
        .then(function(result) {
            let html = result.value;
            
            // Clean up empty paragraphs but preserve line breaks as spacing
            html = html.replace(/<p><\/p>/g, '<br>');
            
            document.getElementById('new-blog-content').value = html;
            showToast("Word Document imported successfully!");
            inputEl.value = '';
        })
        .catch(function(err) {
            console.error(err);
            showToast("Error extracting Word document.");
        });
    };
    reader.onerror = () => showToast("Error reading file.");
    reader.readAsArrayBuffer(file);
}

async function handlePdfImport(file, inputEl) {
    showToast("Extracting PDF document...");
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
        
        let fullHtml = '';
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            
            // Get link annotations for this page
            const annotations = await page.getAnnotations();
            const linkAnnotations = annotations.filter(a => a.subtype === 'Link' && a.url);
            
            // Build lines from text items, preserving structure
            let currentLine = '';
            let lastY = null;
            const lines = [];
            
            textContent.items.forEach(item => {
                const y = Math.round(item.transform[5]);
                
                if (lastY !== null && Math.abs(y - lastY) > 5) {
                    // New line detected
                    if (currentLine.trim()) {
                        lines.push(currentLine.trim());
                    } else {
                        lines.push(''); // Preserve blank lines
                    }
                    currentLine = '';
                }
                
                // Check if this text item falls within a link annotation
                let text = item.str;
                const itemX = item.transform[4];
                const itemY = item.transform[5];
                
                for (const annot of linkAnnotations) {
                    const rect = annot.rect; // [x1, y1, x2, y2]
                    if (itemX >= rect[0] - 2 && itemX <= rect[2] + 2 &&
                        itemY >= rect[1] - 2 && itemY <= rect[3] + 2) {
                        text = `<a href="${annot.url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
                        break;
                    }
                }
                
                currentLine += text;
                lastY = y;
            });
            
            if (currentLine.trim()) {
                lines.push(currentLine.trim());
            }
            
            // Convert lines to paragraphs, grouping consecutive non-empty lines
            let paragraph = '';
            lines.forEach(line => {
                if (line === '') {
                    if (paragraph) {
                        fullHtml += `<p>${paragraph}</p>\n`;
                        paragraph = '';
                    }
                    fullHtml += '<br>\n';
                } else {
                    if (paragraph) paragraph += ' ';
                    paragraph += line;
                }
            });
            if (paragraph) {
                fullHtml += `<p>${paragraph}</p>\n`;
            }
            
            // Add page separator for multi-page PDFs
            if (pageNum < pdf.numPages) {
                fullHtml += '<br>\n';
            }
        }
        
        document.getElementById('new-blog-content').value = fullHtml.trim();
        showToast(`PDF imported successfully! (${pdf.numPages} page${pdf.numPages > 1 ? 's' : ''} extracted)`);
        inputEl.value = '';
    } catch (err) {
        console.error(err);
        showToast("Error extracting PDF: " + err.message);
    }
}

/* ================== INTELLIGENCE HUB LOGIC ================== */

function toggleSidebar() {
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (!overlay) {
        const div = document.createElement('div');
        div.className = 'sidebar-overlay';
        div.onclick = toggleSidebar;
        document.body.appendChild(div);
    }
    
    sidebar.classList.toggle('open');
    document.querySelector('.sidebar-overlay').classList.toggle('active');
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.getElementById(`tab-${tabId}`).style.display = 'block';
    
    document.querySelectorAll('.sidebar-btn').forEach(btn => btn.classList.remove('active'));
    const triggerButton = (typeof event !== 'undefined' && event?.currentTarget)
        || Array.from(document.querySelectorAll('.sidebar-btn')).find(btn => (btn.getAttribute('onclick') || '').includes(`'${tabId}'`));
    if (triggerButton) triggerButton.classList.add('active');

    // Close sidebar on mobile after selection
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
    }
    
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
        // Ensure local timezone formatting for the date string comparison
        const dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        const stat = stats.find(s => s.view_date === dateStr);
        dataPoints.push({
            views: stat ? stat.views : 0,
            initial: days[d.getDay()],
            isToday: i === 0
        });
    }
    
    const maxViews = Math.max(...dataPoints.map(d => d.views), 10);
    
    dataPoints.forEach(pt => {
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.justifyContent = 'flex-end';
        wrapper.style.alignItems = 'center';
        wrapper.style.height = '100%';
        wrapper.style.gap = '5px';
        
        const textLabel = document.createElement('span');
        textLabel.innerText = pt.views;
        textLabel.style.fontSize = '0.8rem';
        textLabel.style.fontWeight = '600';
        textLabel.style.color = pt.isToday ? 'var(--accent)' : 'var(--text-secondary)';

        const height = (pt.views / maxViews) * 100;
        const bar = document.createElement('div');
        bar.style.width = '30px';
        bar.style.height = `${Math.max(height, 4)}%`; // Provide a minimum height so it's always visible
        bar.style.background = 'var(--accent)';
        bar.style.borderRadius = '4px 4px 0 0';
        bar.style.transition = 'height 1s ease-out';
        bar.title = `${pt.views} Views`;
        
        if (!pt.isToday) {
            bar.style.opacity = '0.4';
        } else {
            bar.style.boxShadow = '0 0 20px var(--accent-glow)';
        }
        
        wrapper.appendChild(textLabel);
        wrapper.appendChild(bar);
        chart.appendChild(wrapper);
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
                <td style="min-width: 200px;"><strong>${b.title}</strong></td>
                <td><span class="status-badge">${b.category}</span></td>
                <td style="white-space: nowrap;">👍 ${b.likes} | 👎 ${b.dislikes}</td>
                <td style="display: flex; gap: 0.5rem; flex-wrap: nowrap; align-items: center; white-space: nowrap;">
                    <button class="status-badge" style="background: rgba(124, 58, 237, 0.1); border: 1px solid var(--accent); cursor: pointer;" onclick="editHubArticle(${b.id})">Edit</button>
                    <button class="status-badge" style="background: rgba(255,255,255,0.05); color: #888; border: 1px solid #444; cursor: pointer;" onclick="archiveHubArticle(${b.id})">Archive</button>
                    <button class="delete-action" onclick="deleteHubArticle(${b.id})" style="border: none;">Delete</button>
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
                <td style="min-width: 200px;"><strong>${b.title}</strong></td>
                <td style="display: flex; gap: 0.5rem; flex-wrap: nowrap; align-items: center; white-space: nowrap;">
                    <button class="status-badge" style="background: var(--accent); color: white; border: none; cursor: pointer;" onclick="reviveHubArticle(${b.id})">Revive</button>
                    <button class="delete-action" onclick="deleteHubArticle(${b.id})" style="border: none;">Delete Permanently</button>
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
                <td><button class="delete-action" onclick="deleteHubSubscriber(${s.id})">Delete</button></td>
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
        
        // Robust case-insensitive category selection
        const catSelect = document.getElementById('new-blog-category');
        const blogCat = blog.category;
        const matchingOption = Array.from(catSelect.options).find(opt => 
            opt.value.toLowerCase() === blogCat?.toLowerCase() || 
            opt.innerText.toLowerCase() === blogCat?.toLowerCase()
        );
        if (matchingOption) {
            catSelect.value = matchingOption.value;
        } else if (blogCat) {
            // Fallback for custom categories not in our new dropdown
            const tempOpt = document.createElement('option');
            tempOpt.value = blogCat;
            tempOpt.innerText = blogCat;
            catSelect.appendChild(tempOpt);
            catSelect.value = blogCat;
        }
        
        document.getElementById('new-blog-author').value = blog.author;
        document.getElementById('new-blog-image').value = blog.cover_image;
        const editorTextarea = document.getElementById('new-blog-content');
        editorTextarea.value = blog.content;
        document.getElementById('seo-title').value = blog.seo_title || '';
        document.getElementById('seo-description').value = blog.meta_description || '';
        document.getElementById('seo-canonical-override').value = blog.canonical_override_url || '';
        
        // Load stats visibility
        document.getElementById('show-stats').checked = blog.show_stats !== false;
        updateSeoCounters();
        refreshSeoPreview();
        switchEditorTab('content');
        
        // Trigger auto-resize after loading content
        autoResize(editorTextarea);
        
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
    document.getElementById('show-stats').checked = true;
    document.getElementById('seo-title').value = '';
    document.getElementById('seo-description').value = '';
    document.getElementById('seo-canonical-override').value = '';
    switchEditorTab('content');
    updateSeoCounters();
    refreshSeoPreview();
    
    // Reset textarea height
    const textarea = document.getElementById('new-blog-content');
    if (textarea) {
        textarea.style.height = 'auto';
    }
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

async function deleteHubSubscriber(id) {
    if (!confirm("Remove this subscriber from the network?")) return;
    try {
        const { error } = await supabase.from('subscribers').delete().eq('id', id);
        if (error) throw error;
        showToast("Subscriber removed");
        fetchHubSubscribers();
    } catch (e) {
        showToast("Action failed: " + e.message);
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
    const seoTitle = document.getElementById('seo-title').value.trim();
    const metaDescription = document.getElementById('seo-description').value.trim();
    const canonicalOverride = normalizeCanonicalOverride(document.getElementById('seo-canonical-override').value);
    
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

        // Improved paragraph detection: 
        // 1. Split by double newlines to find paragraphs
        // 2. Wrap each resulting chunk in <p> labels
        if (content.indexOf('<p>') === -1 && content.indexOf('<h') === -1) {
            const paragraphs = content.split(/\n\s*\n/);
            content = paragraphs
                .map(p => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`)
                .join('\n');
        }

        const plainText = stripHtml(content);
        const excerpt = plainText.substring(0, 150) + (plainText.length > 150 ? '...' : '');

        const payload = {
            title,
            category,
            author: author || 'Admin',
            cover_image: cover_image || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
            content,
            excerpt,
            is_archived: false,
            show_stats: document.getElementById('show-stats').checked,
            seo_title: seoTitle || null,
            meta_description: metaDescription || null,
            canonical_override_url: canonicalOverride || null
        };

        if (editingBlogId) {
            const { error } = await supabase.from('blogs').update(payload).eq('id', editingBlogId);
            if (error) throw error;
            showToast("Report updated successfully!");
        } else {
            const { data: insertedBlog, error } = await supabase.from('blogs').insert([payload]).select('id, title').single();
            if (error) throw error;
            editingBlogId = insertedBlog?.id || null;
            refreshSeoPreview();
            showToast("New report published!");
        }
        
        cancelEditing();
        switchTab('articles');
    } catch(err) {
        if ((err.message || '').includes('column')) {
            showToast("Action failed: the SEO database fields are missing. Run the new SQL migration, then try again.");
        } else {
            showToast("Action failed: " + err.message);
        }
    } finally {
        publishBtn.disabled = false;
        publishBtn.innerText = editingBlogId ? "Update Intelligence Report" : "Publish to Intelligence Feed";
    }
});
