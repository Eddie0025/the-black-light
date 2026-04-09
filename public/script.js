let currentArticleId = null;
let userLikeState = null;
let allBlogs = [];
let currentPage = 1;
const pageSize = 5;

// URL Slug Helper
function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text
}

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
    
    // Process URL parameters for deep-linking
    const urlParams = new URLSearchParams(window.location.search);
    const articleId = urlParams.get('id');
    const viewParam = urlParams.get('view');
    
    if (articleId) {
        // Show skeleton immediately
        navigateTo('article', false, { id: articleId });
        fetchArticle(articleId, false); 
    } else if (viewParam === 'article') {
        // Redirect to home if article view requested without an ID
        navigateTo('home', false);
        fetchBlogs();
    } else if (viewParam) {
        navigateTo(viewParam, false);
    } else {
        // Default initial state
        navigateTo('home', false);
        fetchBlogs();
    }
    
    trackView(); 
});

window.onpopstate = function(event) {
    if (event.state) {
        const { view, id, category } = event.state;
        if (view === 'article' && id) {
            fetchArticle(id, false);
        } else if (view === 'home') {
            navigateTo('home', false);
            fetchBlogs(category || null);
        } else {
            navigateTo(view, false);
        }
    } else {
        // Fallback to home if no state
        navigateTo('home', false);
        fetchBlogs();
    }
};

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

function navigateTo(viewId, pushHistory = true, extraData = {}, mode = 'push') {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    const targetView = document.getElementById(`${viewId}-view`);
    if (targetView) targetView.classList.add('active');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (pushHistory) {
        let url = window.location.pathname;
        if (viewId === 'article' && extraData.id) {
            const slug = extraData.title ? `&title=${slugify(extraData.title)}` : '';
            url += `?id=${extraData.id}${slug}`;
        } else if (viewId !== 'home') {
            url += `?view=${viewId}`;
        } else if (extraData.category) {
            url += `?category=${encodeURIComponent(extraData.category)}`;
        }
        
        const state = { 
            view: viewId, 
            id: extraData.id || null, 
            category: extraData.category || null,
            title: extraData.title || null
        };

        if (mode === 'replace') {
            history.replaceState(state, '', url);
        } else {
            history.pushState(state, '', url);
        }
    }
}

// ---- Data Fetching ----

async function fetchBlogs(category = null) {
    try {
        let query = supabase.from('blogs').select('*').eq('is_archived', false).order('id', { ascending: false });
        if (category) {
            query = query.ilike('category', `%${category.trim()}%`);
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
    navigateTo('home', true, { category });
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
        card.onclick = () => fetchArticle(post.id);
        
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

async function fetchArticle(id, pushHistory = true) {
    // Show article view immediately (with skeleton logic)
    // If we already have the title in URL, we can use it, otherwise generic skeleton
    const urlParams = new URLSearchParams(window.location.search);
    const titleFromUrl = urlParams.get('title');
    
    navigateTo('article', pushHistory, { id: id, title: titleFromUrl });

    // Prepare UI for new content (ensure skeletons are visible if they were hidden)
    const skeletonCategory = document.getElementById('skeleton-category');
    const skeletonMeta = document.getElementById('skeleton-meta');
    const articleCover = document.getElementById('article-cover');
    const articleMeta = document.getElementById('article-meta');
    
    if (skeletonCategory) skeletonCategory.style.display = 'block';
    if (skeletonMeta) skeletonMeta.style.display = 'block';
    if (articleCover) articleCover.classList.add('skeleton');
    if (articleMeta) articleMeta.style.opacity = '0';
    
    try {
        const { data: post, error } = await supabase
            .from('blogs')
            .select('*')
            .eq('id', id)
            .single();
            
        if (error) return showToast("Blog not found");
        
        currentArticleId = post.id;
        userLikeState = null;
        
        const catEl = document.getElementById('article-category');
        const titleEl = document.getElementById('article-title');
        const authorEl = document.getElementById('article-author');
        const dateEl = document.getElementById('article-date');
        const coverEl = document.getElementById('article-cover');
        const bodyEl = document.getElementById('article-body');
        
        if (catEl) {
            catEl.innerText = post.category || 'Opinion';
            catEl.style.display = 'inline-block';
        }
        if (titleEl) titleEl.innerText = post.title;
        if (authorEl) authorEl.innerText = `By ${post.author}`;
        
        const dateObj = new Date(post.created_at);
        if (dateEl) dateEl.innerText = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric'});
        
        if (coverEl) {
            coverEl.style.backgroundImage = `url('${post.cover_image}')`;
            coverEl.classList.remove('skeleton');
            coverEl.style.backgroundColor = 'transparent';
        }
        
        if (bodyEl) bodyEl.innerHTML = post.content;
        
        // Hide skeletons and show author meta
        if (skeletonCategory) skeletonCategory.style.display = 'none';
        const skeletonTitle = document.getElementById('skeleton-title');
        if (skeletonTitle) skeletonTitle.style.display = 'none';
        if (skeletonMeta) skeletonMeta.style.display = 'none';
        
        const metaWrapper = document.getElementById('article-meta');
        if (metaWrapper) metaWrapper.style.opacity = '1';
        
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
        
        // Dynamic SEO Update
        updateSEO(
            post.title, 
            post.excerpt || post.content.replace(/<[^>]*>?/gm, '').substring(0, 160), 
            post.cover_image,
            window.location.href
        );
        
        // Use 'replace' mode here so we don't create two history entries 
        // (one for ID and one for ID+Title). This fixes the "Back button twice" issue.
        navigateTo('article', pushHistory, { id: post.id, title: post.title }, 'replace');
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
    const emailInput = document.getElementById('sub-email');
    const submitBtn = e.target.querySelector('button');
    const email = emailInput.value;
    
    // Disable UI during validation
    submitBtn.disabled = true;
    const originalBtnText = submitBtn.innerText;
    submitBtn.innerText = "Authenticating...";

    try {
        // 1. Internal Validation API Call
        const valResponse = await fetch('/api/validate-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        if (!valResponse.ok) {
            const errorData = await valResponse.json();
            throw new Error(errorData.error || "Intelligence verification failed.");
        }

        // 2. Supabase Insertion
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
            emailInput.value = '';
            showToast("Successfully subscribed!");
        }
    } catch(e) {
        showToast(e.message || "Error subscribing. Please try again.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = originalBtnText;
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

// ---- Sharing Suite ----

async function handleShare() {
    const shareData = {
        title: document.getElementById('article-title').innerText,
        text: 'The Black Light | Professional Intelligence Report',
        url: window.location.href
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (err) {
            if (err.name !== 'AbortError') showShareModal();
        }
    } else {
        showShareModal();
    }
}

function showShareModal() {
    document.getElementById('share-modal').classList.add('show');
}

function closeShareModal() {
    document.getElementById('share-modal').classList.remove('show');
}

function shareTo(platform) {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(document.getElementById('article-title').innerText);
    let shareUrl = '';

    switch(platform) {
        case 'x': 
            shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${text}`;
            break;
        case 'whatsapp':
            shareUrl = `https://wa.me/?text=${text}%20${url}`;
            break;
        case 'linkedin':
            shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
            break;
    }

    if (shareUrl) window.open(shareUrl, '_blank');
}

function copyArticleLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
        showToast("Intelligence link copied to clipboard");
        closeShareModal();
    });
}

// ---- SEO Engine ----

function updateSEO(title, description, image, url) {
    // Standard Tags
    document.title = `${title} | The Black Light`;
    const metaDesc = document.getElementById('meta-desc');
    if (metaDesc) metaDesc.setAttribute('content', description);

    // OpenGraph Tags
    const ogTitle = document.getElementById('og-title');
    const ogDesc = document.getElementById('og-desc');
    const ogImage = document.getElementById('og-image');
    if (ogTitle) ogTitle.setAttribute('content', title);
    if (ogDesc) ogDesc.setAttribute('content', description);
    if (ogImage) ogImage.setAttribute('content', image);

    // Canonical
    const canonical = document.getElementById('canonical-url');
    if (canonical) canonical.setAttribute('href', url);
}

function resetSEO() {
    updateSEO(
        "The Black Light | Professional Intelligence & Insights",
        "Deep-dive analysis on global macroeconomics, energy markets, and international policy.",
        "black_light_logo.png",
        "https://theblacklight.blog/"
    );
}

// Hook reset into navigation - Fix: Properly spread arguments to avoid losing data like article ID
const originalNavigateTo = navigateTo;
navigateTo = function(...args) {
    if (args[0] === 'home') resetSEO();
    originalNavigateTo(...args);
};
