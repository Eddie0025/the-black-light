let currentArticleId = null;
let userLikeState = null;
let allBlogs = [];
let currentPage = 1;
const pageSize = 5;

// Intersection Observer for Scroll Reveals
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
    }
}

function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
}

// Navbar Glassmorphism on Scroll
window.addEventListener('scroll', () => {
    const nav = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }
});

document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    renderSkeletons();
    fetchBlogs();
    trackView(); 
});

async function trackView() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { data: current } = await supabase
            .from('analytics')
            .select('views')
            .eq('view_date', today)
            .single();
            
        if (current) {
            await supabase
                .from('analytics')
                .update({ views: (current.views || 0) + 1 })
                .eq('view_date', today);
        } else {
            await supabase
                .from('analytics')
                .insert([{ view_date: today, views: 1 }]);
        }
    } catch (e) {
        // Analytics silent fail
    }
}

function renderSkeletons() {
    const grid = document.getElementById('blog-grid');
    grid.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton card-skeleton';
        grid.appendChild(skeleton);
    }
}

function navigateTo(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`${viewId}-view`).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---- Data Fetching ----

async function fetchBlogs(category = null) {
    try {
        let query = supabase.from('blogs').select('*').eq('is_archived', false).order('id', { ascending: false });
        if (category) {
            query = query.ilike('category', category);
        }
        
        const { data: blogs, error } = await query;
            
        if (error) throw error;
        allBlogs = blogs;
        currentPage = 1; 
        
        const heroTitle = document.querySelector('.hero h2');
        if (heroTitle) {
            heroTitle.innerText = category ? category + ' Intelligence' : 'Illuminating the unseen.';
        }
        
        renderHomeFeed();
    } catch (e) {
        console.error(e);
    }
}

function loadCategory(category) {
    navigateTo('home');
    fetchBlogs(category);
}

function loadHome() {
    navigateTo('home');
    fetchBlogs(null);
}

function renderHomeFeed() {
    const grid = document.getElementById('blog-grid');
    grid.innerHTML = '';
    
    if (allBlogs.length === 0) {
        grid.innerHTML = '<p style="text-align:center; color:var(--text-secondary); width:100%; margin: 3rem 0; font-size: 1.2rem;">No articles found for this category yet.</p>';
        const controls = document.getElementById('pagination-controls');
        if (controls) controls.innerHTML = '';
        return;
    }
    
    // Pagination Slicing
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageItems = allBlogs.slice(start, end);
    
    pageItems.forEach((post, index) => {
        const card = document.createElement('div');
        card.className = 'blog-card reveal';
        card.style.transitionDelay = `${index * 0.1}s`;
        card.onclick = () => openArticle(post.id);
        
        card.innerHTML = `
            <div class="card-img" style="background-image: url('${post.cover_image}')"></div>
            <div class="card-content">
                <span class="card-category">${post.category}</span>
                <h3 class="card-title">${post.title}</h3>
                <p class="card-excerpt">${post.excerpt}</p>
            </div>
        `;
        
        grid.appendChild(card);
        revealObserver.observe(card);
    });
    
    renderPagination();
}

function renderPagination() {
    const controls = document.getElementById('pagination-controls');
    if (!controls) return;
    
    const totalPages = Math.ceil(allBlogs.length / pageSize);
    if (totalPages <= 1) {
        controls.innerHTML = '';
        return;
    }
    
    controls.innerHTML = `
        <button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(-1)">← Previous</button>
        <span class="page-info">Page ${currentPage} of ${totalPages}</span>
        <button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(1)">Next →</button>
    `;
}

function changePage(delta) {
    currentPage += delta;
    window.scrollTo({ top: 300, behavior: 'smooth' }); 
    renderHomeFeed();
}

async function openArticle(id) {
    try {
        const { data: post, error } = await supabase
            .from('blogs')
            .select('*')
            .eq('id', id)
            .single();
            
        if (error) return showToast("Blog not found");
        
        currentArticleId = post.id;
        userLikeState = null;
        
        document.getElementById('article-category').innerText = post.category || 'Opinion';
        document.getElementById('article-title').innerText = post.title;
        document.getElementById('article-author').innerText = `By ${post.author}`;
        
        const dateObj = new Date(post.created_at);
        document.getElementById('article-date').innerText = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric'});
        
        document.getElementById('article-cover').style.backgroundImage = `url('${post.cover_image}')`;
        document.getElementById('article-body').innerHTML = post.content;
        
        // Handle stats visibility
        const statsWrapper = document.getElementById('stats-wrapper');
        if (post.show_stats) {
            if (statsWrapper) statsWrapper.style.display = 'flex';
            document.getElementById('likes-display').innerText = post.likes;
            document.getElementById('dislikes-display').innerText = post.dislikes;
        } else {
            if (statsWrapper) statsWrapper.style.display = 'none';
        }
        
        // Reset interaction buttons appearance
        document.querySelector('.like-btn').classList.remove('active-like');
        document.querySelector('.dislike-btn').classList.remove('active-dislike');
        
        // Fetch comments
        const { data: comments } = await supabase
            .from('comments')
            .select('*')
            .eq('blog_id', id)
            .order('id', { ascending: true });
            
        renderComments(comments || []);
        
        navigateTo('article');
        trackView(); 
    } catch (e) {
        console.error("Failed to fetch article", e);
    }
}

async function toggleLike() {
    if (!currentArticleId || userLikeState === 'like') return;
    try {
        const { data: blog } = await supabase.from('blogs').select('likes').eq('id', currentArticleId).single();
        const { error } = await supabase
            .from('blogs')
            .update({ likes: (blog.likes || 0) + 1 })
            .eq('id', currentArticleId);
            
        if (error) throw error;
        
        document.getElementById('likes-display').innerText = (blog.likes || 0) + 1;
        document.querySelector('.like-btn').classList.add('active-like');
        document.querySelector('.dislike-btn').classList.remove('active-dislike');
        userLikeState = 'like';
    } catch (e) {
        console.error("Error liking blog", e);
    }
}

async function toggleDislike() {
    if (!currentArticleId || userLikeState === 'dislike') return;
    try {
        const { data: blog } = await supabase.from('blogs').select('dislikes').eq('id', currentArticleId).single();
        const { error } = await supabase
            .from('blogs')
            .update({ dislikes: (blog.dislikes || 0) + 1 })
            .eq('id', currentArticleId);
            
        if (error) throw error;
        
        document.getElementById('dislikes-display').innerText = (blog.dislikes || 0) + 1;
        document.querySelector('.dislike-btn').classList.add('active-dislike');
        document.querySelector('.like-btn').classList.remove('active-like');
        userLikeState = 'dislike';
    } catch (e) {
        console.error("Error disliking blog", e);
    }
}

function renderComments(comments) {
    const list = document.getElementById('comments-list');
    const countDisplay = document.getElementById('comment-count');
    
    countDisplay.innerText = comments.length;
    list.innerHTML = '';
    
    comments.forEach(c => {
        const div = document.createElement('div');
        div.className = 'comment';
        const dateObj = new Date(c.created_at);
        
        div.innerHTML = `
            <div class="comment-header">
                <span class="comment-author">${c.name}</span>
                <span class="comment-date">${dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric'})}</span>
            </div>
            <div class="comment-text">${c.text}</div>
        `;
        list.appendChild(div);
    });
}

async function submitComment(e) {
    e.preventDefault();
    if (!currentArticleId) return;
    
    const nameInput = document.getElementById('comment-name');
    const textInput = document.getElementById('comment-text');
    
    const payload = {
        blog_id: currentArticleId,
        name: nameInput.value,
        text: textInput.value
    };
    
    try {
        const { data, error } = await supabase
            .from('comments')
            .insert([payload])
            .select();
            
        if (error) throw error;
        
        if (data && data.length > 0) {
            const newComment = data[0];
            
            const list = document.getElementById('comments-list');
            const countDisplay = document.getElementById('comment-count');
            countDisplay.innerText = parseInt(countDisplay.innerText) + 1;
            
            const div = document.createElement('div');
            div.className = 'comment';
            const dateObj = new Date(newComment.created_at);
            
            div.innerHTML = `
                <div class="comment-header">
                    <span class="comment-author">${newComment.name}</span>
                    <span class="comment-date">${dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric'})}</span>
                </div>
                <div class="comment-text">${newComment.text}</div>
            `;
            list.appendChild(div);
            textInput.value = '';
            showToast("Comment successfully posted!");
        }
    } catch(e) {
        showToast("Error posting comment: " + e.message);
    }
}

async function handleSubscribe(e) {
    e.preventDefault();
    const email = document.getElementById('sub-email').value;
    
    try {
        const { error } = await supabase
            .from('subscribers')
            .insert([{ email: email }]);
            
        if (error) {
            if (error.code === '23505') { 
                showToast("Already subscribed");
            } else {
                throw error;
            }
        } else {
            document.getElementById('sub-email').value = '';
            showToast("Successfully subscribed!");
        }
    } catch(e) {
        showToast("Error subscribing. Please try again.");
    }
}

function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}
