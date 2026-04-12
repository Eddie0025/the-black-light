let currentArticleId = null;
let userLikeState = null;
let allBlogs = [];
let currentPage = 1;
let activeCategory = null;
let globalAuthorProfile = null;
const pageSize = 5;
const SITE_ORIGIN = 'https://www.theblacklight.blog';

// URL Slug Helper
function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text
}

function stripHtml(html) {
    return (html || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
}

function buildArticlePath(id, title) {
    if (!id) return '/';
    const slug = slugify(title || 'article') || 'article';
    return `/article/${id}-${slug}`;
}

function buildArticleUrl(post) {
    const overrideUrl = (post?.canonical_override_url || '').trim();
    if (overrideUrl) {
        if (/^https?:\/\//i.test(overrideUrl)) return overrideUrl;
        if (overrideUrl.startsWith('/')) return `${SITE_ORIGIN}${overrideUrl}`;
        return `https://${overrideUrl.replace(/^\/+/, '')}`;
    }

    return `${SITE_ORIGIN}${buildArticlePath(post?.id, post?.title)}`;
}

function getSeoTitle(post) {
    return post?.seo_title?.trim() || post?.title || 'The Black Light';
}

function getMetaDescription(post) {
    const explicitDescription = post?.meta_description?.trim();
    if (explicitDescription) return explicitDescription;

    const fallbackText = post?.excerpt?.trim() || stripHtml(post?.content || '');
    if (fallbackText.length <= 160) return fallbackText;
    return `${fallbackText.substring(0, 157).trimEnd()}...`;
}

// Dynamic Keywords based on article category
const CATEGORY_KEYWORDS = {
    'Global Markets': 'global markets, stock market, financial analysis, market trends, investment, trading, equities, Wall Street',
    'Energy': 'energy markets, oil prices, crude oil, natural gas, OPEC, renewable energy, energy policy, petroleum',
    'Economics': 'economics, macroeconomics, GDP, inflation, interest rates, fiscal policy, economic growth, recession',
    'Policy': 'policy analysis, government policy, regulation, international policy, trade policy, sanctions, legislation',
    'Geopolitics': 'geopolitics, international relations, foreign policy, geopolitical risk, diplomacy, conflict, NATO, global security',
    'Technology': 'technology, tech industry, AI, artificial intelligence, cybersecurity, digital transformation, innovation'
};

function getDynamicKeywords(post) {
    const base = 'The Black Light, intelligence, analysis, professional insights';
    const categoryKeywords = CATEGORY_KEYWORDS[post?.category] || '';
    const titleWords = (post?.title || '').split(/\s+/).filter(w => w.length > 3).slice(0, 5).join(', ');
    return [base, categoryKeywords, titleWords].filter(Boolean).join(', ');
}

function parseArticleIdFromLocation() {
    const pathMatch = window.location.pathname.match(/^\/article\/(\d+)(?:-[^/]*)?\/?$/i);
    if (pathMatch) return pathMatch[1];

    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
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

document.addEventListener("DOMContentLoaded", async () => {
    initTheme();
    renderSkeletons();
    await fetchAuthorProfile();
    
    // Process URL parameters for deep-linking
    const urlParams = new URLSearchParams(window.location.search);
    const articleId = parseArticleIdFromLocation();
    const viewParam = urlParams.get('view');
    const categoryParam = urlParams.get('category');
    
    if (articleId) {
        navigateTo('article', false, { id: articleId });
        fetchArticle(articleId, false); 
    } else if (viewParam === 'article') {
        navigateTo('home', false);
        fetchBlogs();
    } else if (categoryParam) {
        navigateTo('home', false, { category: categoryParam });
        fetchBlogs(categoryParam);
    } else if (viewParam) {
        navigateTo(viewParam, false);
    } else {
        // Default initial state
        navigateTo('home', false);
        fetchBlogs();
    }
    
    // Initial Home/Category SEO
    updateHomeSEO(categoryParam);
    
    // Critical Asset Discovery & Cleanup
    const overlay = document.getElementById('illumination-overlay');
    if (overlay) {
        overlay.addEventListener('animationend', () => overlay.remove());
        setTimeout(() => overlay.remove(), 5000);
    }

    if (articleId) preloadArticleCover(articleId);
    trackView(); 
});

async function preloadArticleCover(id) {
    try {
        const { data: post } = await supabase.from('blogs').select('cover_image').eq('id', id).single();
        if (post && post.cover_image) {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = post.cover_image;
            document.head.appendChild(link);
        }
    } catch (e) {}
}

window.onpopstate = function(event) {
    const articleIdFromPath = parseArticleIdFromLocation();

    if (!event.state && articleIdFromPath) {
        fetchArticle(articleIdFromPath, false);
        return;
    }

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
            url = buildArticlePath(extraData.id, extraData.title);
        } else if (viewId !== 'home') {
            url += `?view=${viewId}`;
        } else if (extraData.category) {
            url = `/?category=${encodeURIComponent(extraData.category)}`;
        } else if (viewId === 'home') {
            url = '/';
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

// =================== AUTHOR PROFILE ===================
async function fetchAuthorProfile() {
    try {
        const { data, error } = await supabase
            .from('site_content')
            .select('content')
            .eq('key', 'author_profile')
            .maybeSingle();

        if (data && data.content) {
            // Supabase may return content as string or already-parsed object
            globalAuthorProfile = typeof data.content === 'string'
                ? JSON.parse(data.content)
                : data.content;
            
            // Pre-fill the footer author card
            const footerCard = document.getElementById('footer-author-card');
            if (footerCard && globalAuthorProfile) {
                document.getElementById('footer-author-image').src = globalAuthorProfile.image_url || 'black_light_logo.png';
                document.getElementById('footer-author-name').innerText = globalAuthorProfile.name || 'Author';
                document.getElementById('footer-author-title').innerText = globalAuthorProfile.title || 'Author';
                footerCard.style.display = 'flex';
            }
        }
    } catch (e) {
        console.error("Error fetching author profile:", e);
    }
}

function openAuthorModal() {
    const modal = document.getElementById('author-modal');
    if (!modal) return;
    
    // Ensure data is set if they click before pre-fill or cache updates
    if (globalAuthorProfile) {
        document.getElementById('modal-author-image').src = globalAuthorProfile.image_url || 'black_light_logo.png';
        document.getElementById('modal-author-name').innerText = globalAuthorProfile.name || 'Author';
        document.getElementById('modal-author-title').innerText = globalAuthorProfile.title || 'Author';
        document.getElementById('modal-author-bio').innerText = globalAuthorProfile.bio || '';
    } else {
        document.getElementById('modal-author-image').src = 'black_light_logo.png';
        document.getElementById('modal-author-name').innerText = 'The Black Light';
        document.getElementById('modal-author-title').innerText = 'Author';
        document.getElementById('modal-author-bio').innerText = 'Information about the author will be displayed here.';
    }
    
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.add('show');
        
        // Check if content overflows to show scroll button
    }, 10);
}

function closeAuthorModal() {
    const modal = document.getElementById('author-modal');
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}


// =================== ARTICLE FETCHING ===================
async function fetchBlogs(category = null) {
    try {
        activeCategory = category ? category.trim() : null;
        let query = supabase.from('blogs').select('*').eq('is_archived', false).order('id', { ascending: false });
        if (activeCategory) {
            query = query.ilike('category', `%${activeCategory}%`);
        }
        
        const { data: blogs, error } = await query;
            
        if (error) throw error;
        allBlogs = blogs;
        currentPage = 1; 
        
        const heroTitle = document.querySelector('.hero h2');
        if (heroTitle) {
            heroTitle.innerText = activeCategory ? activeCategory + ' Intelligence' : 'Illuminating the unseen.';
        }
        updateCategoryChips();
        
        renderHomeFeed();
        updateHomeSEO(activeCategory);
    } catch (e) {
        console.error(e);
    }
}

function updateCategoryChips() {
    document.querySelectorAll('.category-chip').forEach(chip => {
        const chipCategory = chip.dataset.category?.trim() || '';
        const isActive = (activeCategory || '') === chipCategory;
        chip.classList.toggle('active', isActive);
        chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
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
            <img class="card-img" src="${post.cover_image}" alt="${post.title}" loading="lazy">
            <div class="card-content">
                <span class="card-category">${post.category}</span>
                <h2 class="card-title">${post.title}</h2>
                <span style="display: block; font-size: 0.85rem; color: var(--accent); font-weight: 600; margin-top: -0.5rem; margin-bottom: 0.8rem; letter-spacing: 0.5px;">By ${post.author || 'The Black Light'}</span>
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
    navigateTo('article', pushHistory, { id });

    // Prepare UI for new content (ensure skeletons are visible if they were hidden)
    const skeletonCategory = document.getElementById('skeleton-category');
    const skeletonMeta = document.getElementById('skeleton-meta');
    const coverContainer = document.getElementById('cover-skeleton-container');
    const articleMeta = document.getElementById('article-meta');
    
    if (skeletonCategory) skeletonCategory.style.display = 'block';
    if (skeletonMeta) skeletonMeta.style.display = 'block';
    if (coverContainer) {
        coverContainer.classList.add('skeleton');
        const img = coverContainer.querySelector('img');
        if (img) img.style.display = 'none';
    }
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
            coverEl.src = post.cover_image;
            coverEl.alt = post.title || 'Intelligence Cover';
            coverEl.onload = () => {
                const container = document.getElementById('cover-skeleton-container');
                if (container) container.classList.remove('skeleton');
                coverEl.style.display = 'block';
                coverEl.style.opacity = '1';
            };
        }
        
        if (bodyEl) bodyEl.innerHTML = post.content;
        
        // Hide skeletons and show author meta
        if (skeletonCategory) skeletonCategory.style.display = 'none';
        const skeletonTitle = document.getElementById('skeleton-title');
        if (skeletonTitle) skeletonTitle.style.display = 'none';
        if (skeletonMeta) skeletonMeta.style.display = 'none';
        
        // Inject global author info at the end of the article
        const authorBioCard = document.getElementById('article-author-bio');
        if (authorBioCard && globalAuthorProfile) {
            document.getElementById('inline-author-image').src = globalAuthorProfile.image_url || 'black_light_logo.png';
            document.getElementById('inline-author-name').innerText = globalAuthorProfile.name || 'Author';
            document.getElementById('inline-author-title').innerText = globalAuthorProfile.title || 'Author';
            document.getElementById('inline-author-bio').innerText = globalAuthorProfile.bio || '';
            authorBioCard.style.display = 'flex';
        } else if (authorBioCard) {
            authorBioCard.style.display = 'none';
        }

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
        updateSEO(post);
        
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

function updateArticleSchema(post, canonicalUrl, description, seoTitle) {
    const schemaScript = document.getElementById('article-schema');
    if (!schemaScript) return;

    const articleSchema = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: seoTitle,
        description,
        image: post.cover_image ? [post.cover_image] : undefined,
        datePublished: post.created_at,
        dateModified: post.updated_at || post.created_at,
        mainEntityOfPage: canonicalUrl,
        author: {
            '@type': 'Person',
            name: post.author || 'The Black Light'
        },
        publisher: {
            '@type': 'Organization',
            name: 'The Black Light',
            logo: {
                '@type': 'ImageObject',
                url: `${SITE_ORIGIN}/black_light_logo.png`
            }
        },
        articleSection: post.category || 'Analysis',
        url: canonicalUrl
    };

    schemaScript.textContent = JSON.stringify(articleSchema);
}

function updateBreadcrumbSchema(post, canonicalUrl) {
    const breadcrumbScript = document.getElementById('breadcrumb-schema');
    if (!breadcrumbScript) return;

    const breadcrumbs = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: 'The Black Light',
                item: SITE_ORIGIN
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: post.category || 'Analysis',
                item: `${SITE_ORIGIN}/?category=${encodeURIComponent(post.category || 'Analysis')}`
            },
            {
                '@type': 'ListItem',
                position: 3,
                name: post.title || 'Article'
            }
        ]
    };

    breadcrumbScript.textContent = JSON.stringify(breadcrumbs);
}

function clearBreadcrumbSchema() {
    const breadcrumbScript = document.getElementById('breadcrumb-schema');
    if (breadcrumbScript) breadcrumbScript.textContent = '';
}

function clearArticleSchema() {
    const schemaScript = document.getElementById('article-schema');
    if (schemaScript) schemaScript.textContent = '';
}

function updateSEO(post) {
    const seoTitle = getSeoTitle(post);
    const description = getMetaDescription(post);
    const canonicalUrl = buildArticleUrl(post);
    const imageUrl = post.cover_image || `${SITE_ORIGIN}/black_light_logo.png`;

    document.title = `${seoTitle} | The Black Light`;
    
    const setMeta = (id, attr, value) => {
        const el = document.getElementById(id);
        if (el) el.setAttribute(attr, value);
    };

    setMeta('meta-desc', 'content', description);
    setMeta('meta-keywords', 'content', getDynamicKeywords(post));
    
    // OpenGraph
    setMeta('og-title', 'content', `${seoTitle} | The Black Light`);
    setMeta('og-desc', 'content', description);
    setMeta('og-image', 'content', imageUrl);
    setMeta('og-url', 'content', canonicalUrl);
    setMeta('og-type', 'content', 'article');

    // Twitter
    setMeta('twitter-title', 'content', `${seoTitle} | The Black Light`);
    setMeta('twitter-desc', 'content', description);
    setMeta('twitter-image', 'content', imageUrl);
    setMeta('twitter-card', 'content', 'summary_large_image');

    // Canonical
    const canonical = document.getElementById('canonical-url');
    if (canonical) canonical.setAttribute('href', canonicalUrl);

    updateArticleSchema(post, canonicalUrl, description, seoTitle);
    updateBreadcrumbSchema(post, canonicalUrl);
}

function updateHomeSEO(category = null) {
    const baseTitle = "The Black Light | Professional Intelligence & Insights";
    const baseDesc = "Deep-dive analysis on global macroeconomics, energy markets, and international policy. Illuminating the unseen patterns in global affairs.";
    const defaultImage = `${SITE_ORIGIN}/black_light_logo.png`;
    
    let title = baseTitle;
    let desc = baseDesc;
    let url = SITE_ORIGIN + "/";

    if (category) {
        title = `${category} Intelligence | The Black Light`;
        desc = `Explore professional insights and analysis on ${category} from The Black Light.`;
        url = `${SITE_ORIGIN}/?category=${encodeURIComponent(category)}`;
    }

    document.title = title;

    const setMeta = (id, attr, value) => {
        const el = document.getElementById(id);
        if (el) el.setAttribute(attr, value);
    };

    setMeta('meta-desc', 'content', desc);
    setMeta('meta-keywords', 'content', 'blog, intelligence, macroeconomics, policy, energy, professional insights, global markets, geopolitics, economics, analysis');
    
    // OpenGraph
    setMeta('og-title', 'content', title);
    setMeta('og-desc', 'content', desc);
    setMeta('og-image', 'content', defaultImage);
    setMeta('og-url', 'content', url);
    setMeta('og-type', 'content', 'website');

    // Reset Twitter
    setMeta('twitter-title', 'content', title);
    setMeta('twitter-desc', 'content', desc);
    setMeta('twitter-image', 'content', defaultImage);

    // Canonical
    const canonical = document.getElementById('canonical-url');
    if (canonical) canonical.setAttribute('href', url);

    // Dynamic Home/Collection Schema
    updateCollectionSchema(category, url, desc, title);

    // Clean up schemas for home page
    clearArticleSchema();
    clearBreadcrumbSchema();
}

function updateCollectionSchema(category, url, description, title) {
    let schemaScript = document.getElementById('collection-schema');
    if (!schemaScript) {
        schemaScript = document.createElement('script');
        schemaScript.type = 'application/ld+json';
        schemaScript.id = 'collection-schema';
        document.head.appendChild(schemaScript);
    }

    const schema = {
        '@context': 'https://schema.org',
        '@type': category ? 'CollectionPage' : 'WebSite',
        name: title,
        url: url,
        description: description,
        publisher: {
            '@type': 'Organization',
            name: 'The Black Light'
        }
    };
    schemaScript.textContent = JSON.stringify(schema);
}

// Hook reset into navigation - Fix: Properly spread arguments to avoid losing data like article ID
const originalNavigateTo = navigateTo;
navigateTo = function(...args) {
    if (args[0] === 'home') updateHomeSEO(activeCategory);
    originalNavigateTo(...args);
};
