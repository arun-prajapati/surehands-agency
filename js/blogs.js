(function () {
  const API_URL =
    "https://lemeowapis.meowadvancedintelligence.com/api/sites/surehandagency-1785928272/blogs?nopaginate=1";

  const SITE_URL = "https://surehandagency.com";
  let cachedBlogs = null;

  // Text from the API is escaped before it goes into HTML.
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function plainText(html) {
    const div = document.createElement("div");
    div.innerHTML = String(html ?? "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");
    return (div.textContent || "").replace(/\s+/g, " ").trim();
  }

  // Article HTML comes from the admin editor (BlockNote). Keep its markup, classes and styles,
  // but remove anything that can run code: script-like elements, on* handlers, javascript: URLs.
  const BLOCKED = new Set(["SCRIPT", "IFRAME", "OBJECT", "EMBED", "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT", "LINK", "META", "BASE", "FRAME", "FRAMESET", "NOSCRIPT", "TEMPLATE"]);
  function sanitize(html) {
    const doc = new DOMParser().parseFromString(`<div>${html || ""}</div>`, "text/html");
    const root = doc.body.firstChild;
    root.querySelectorAll("*").forEach((el) => {
      if (BLOCKED.has(el.tagName)) return el.remove();
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const value = attr.value.replace(/[\s\u0000-\u001f]/g, "").toLowerCase();
        if (name.startsWith("on")) el.removeAttribute(attr.name);
        else if (["href", "src", "xlink:href", "action", "formaction", "srcdoc"].includes(name) &&
          (value.startsWith("javascript:") || value.startsWith("vbscript:") || (value.startsWith("data:") && !value.startsWith("data:image/")) || name === "srcdoc"))
          el.removeAttribute(attr.name);
      }
      if (el.tagName === "A" && el.getAttribute("target") === "_blank") el.setAttribute("rel", "noopener noreferrer");
    });
    // The page already has one <h1> (the article title).
    root.querySelectorAll("h1").forEach((h) => {
      const h2 = doc.createElement("h2");
      for (const a of Array.from(h.attributes)) h2.setAttribute(a.name, a.value);
      h2.append(...h.childNodes);
      h.replaceWith(h2);
    });
    return root.innerHTML;
  }

  function setMeta(selector, attr, value) {
    let el = document.head.querySelector(selector);
    if (!el) {
      const m = selector.match(/^(meta|link)\[(name|property|rel)="([^"]+)"\]$/);
      el = document.createElement(m[1]);
      el.setAttribute(m[2], m[3]);
      document.head.appendChild(el);
    }
    el.setAttribute(attr, value);
  }

  // BlogPosting structured data for one article (SEO audit: posts need Article / BlogPosting JSON-LD)
  function addPostSchema({ title, description, image, date, updated, url }) {
    const iso = (v) => {
      const d = new Date(String(v ?? "").replace(" ", "T"));
      return isNaN(d.getTime()) ? undefined : d.toISOString();
    };
    const data = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: String(title).slice(0, 110),
      description: description || undefined,
      image: image ? [image] : undefined,
      datePublished: iso(date),
      dateModified: iso(updated || date),
      author: { "@type": "Organization", name: "SureHands Agency", url: `${SITE_URL}/` },
      publisher: { "@type": "Organization", name: "SureHands Agency", logo: { "@type": "ImageObject", url: `${SITE_URL}/images/icon-192.png` } },
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      url,
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }

  async function fetchBlogs() {
    if (cachedBlogs) return cachedBlogs;
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json())?.data ?? [];
      cachedBlogs = Array.isArray(data) ? data : [data];
      return cachedBlogs;
    } catch (err) {
      console.log("BLOGS GET ERROR /", err);
      return [];
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-SG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function getCoverImage(blog) {
    return (
      blog.cover_photo_url || blog.cover_photo || blog.featured_image || ""
    );
  }

  function isPublished(blog) {
    return blog.status === "published" || blog.pivot?.status === "published";
  }

  function getPublishedDate(blog) {
    return blog.published_at || blog.pivot?.published_at || blog.created_at;
  }

  function sortNewestFirst(blogs) {
    return [...blogs].sort((a, b) => {
      const dateA = new Date(getPublishedDate(a) || 0);
      const dateB = new Date(getPublishedDate(b) || 0);
      return dateB - dateA;
    });
  }

  function createBlogCard(blog) {
    const card = document.createElement("article");
    card.className = "blog-card reveal";

    const coverUrl = getCoverImage(blog);
    const pubDate = formatDate(getPublishedDate(blog));
    const author = esc(blog.author || "SureHands Team");
    const title = esc(plainText(blog.title));

    card.innerHTML = `
      <a href="blog-details.html?slug=${encodeURIComponent(blog.slug)}" class="blog-card__image-wrap">
        ${
          coverUrl
            ? `<img src="${esc(coverUrl)}" alt="${title}" class="blog-card__image" loading="lazy" onerror="this.parentElement.style.display='none'">`
            : ""
        }
      </a>
      <div class="blog-card__body">
        <div class="blog-card__meta">
          <span>${pubDate}</span>
          <span class="blog-card__meta-dot"></span>
          <span>${author}</span>
        </div>
        <h3 class="blog-card__title">${title}</h3>
        <p class="blog-card__desc">${esc(plainText(blog.description))}</p>
        <div class="blog-card__footer">
          <span class="blog-card__author">${author}</span>
          <a href="blog-details.html?slug=${encodeURIComponent(blog.slug)}" class="blog-card__readmore">
            Read More
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </a>
        </div>
      </div>
    `;
    return card;
  }

  function revealNewCards() {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" },
    );
    document
      .querySelectorAll(".blog-card.reveal")
      .forEach((el) => io.observe(el));
  }

  async function initBlogSection() {
    const grid = document.getElementById("blog-grid");
    const skeleton = document.getElementById("blog-skeleton");
    const empty = document.getElementById("blog-empty");
    if (!grid) return;

    const blogs = await fetchBlogs();
    const published = sortNewestFirst(blogs.filter(isPublished));

    skeleton.style.display = "none";

    if (published.length === 0) {
      empty.classList.remove("hidden");
      return;
    }

    const latest = published.slice(0, 3);
    latest.forEach((blog) => {
      grid.appendChild(createBlogCard(blog));
    });

    revealNewCards();
  }

  async function initBlogListing() {
    const grid = document.getElementById("blog-listing-grid");
    const skeleton = document.getElementById("blog-listing-skeleton");
    const empty = document.getElementById("blog-listing-empty");
    if (!grid) return;

    const blogs = await fetchBlogs();
    const published = sortNewestFirst(blogs.filter(isPublished));

    skeleton.style.display = "none";

    if (published.length === 0) {
      empty.classList.remove("hidden");
      return;
    }

    published.forEach((blog) => {
      grid.appendChild(createBlogCard(blog));
    });

    revealNewCards();
  }

  async function initBlogDetails() {
    const container = document.getElementById("blog-detail-content");
    const notFound = document.getElementById("blog-not-found");
    const skeleton = document.getElementById("blog-detail-skeleton");
    if (!container) return;

    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug");

    if (!slug) {
      if (skeleton) skeleton.style.display = "none";
      if (notFound) notFound.classList.remove("hidden");
      return;
    }

    const blogs = await fetchBlogs();
    const blog = blogs.find((b) => b.slug === slug);

    if (skeleton) skeleton.style.display = "none";

    if (!blog) {
      setMeta('meta[name="robots"]', "content", "noindex");
      if (notFound) notFound.classList.remove("hidden");
      return;
    }

    const title = plainText(blog.title);
    const summary = plainText(blog.excerpt || blog.description || blog.content).slice(0, 155);
    const url = `${SITE_URL}/blog-details.html?slug=${encodeURIComponent(blog.slug)}`;
    document.title = `${title} · SureHands Agency`;
    setMeta('link[rel="canonical"]', "href", url);
    setMeta('meta[property="og:url"]', "content", url);
    setMeta('meta[property="og:type"]', "content", "article");
    setMeta('meta[property="og:title"]', "content", `${title} · SureHands Agency`);
    setMeta('meta[name="twitter:title"]', "content", `${title} · SureHands Agency`);
    if (summary) {
      setMeta('meta[name="description"]', "content", summary);
      setMeta('meta[property="og:description"]', "content", summary);
      setMeta('meta[name="twitter:description"]', "content", summary);
    }

    const coverUrl = getCoverImage(blog);
    if (coverUrl) {
      setMeta('meta[property="og:image"]', "content", coverUrl);
      setMeta('meta[name="twitter:image"]', "content", coverUrl);
    }
    addPostSchema({
      title,
      description: summary,
      image: coverUrl,
      date: getPublishedDate(blog),
      updated: blog.updated_at,
      url,
    });
    const pubDate = formatDate(getPublishedDate(blog));
    const author = esc(blog.author || "SureHands Team");
    const tags = blog.tags || [];
    const views = Number(blog.views) || 0;

    const metaHTML = `
      <div class="blog-detail__meta">
        <span>${pubDate}</span>
        <span class="blog-detail__meta-dot"></span>
        <span>By ${author}</span>
        ${views > 0 ? `<span class="blog-detail__meta-dot"></span><span>${views} views</span>` : ""}
      </div>
    `;

    const tagsHTML =
      tags.length > 0
        ? `<div class="blog-detail__tags">${tags.map((t) => `<span class="blog-detail__tag">${esc(t)}</span>`).join("")}</div>`
        : "";

    container.innerHTML = `
      <a href="blog.html" class="blog-detail__back">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M13 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Back to all articles
      </a>
      ${metaHTML}
      <h1 class="blog-detail__title">${esc(title)}</h1>
      ${tagsHTML}
      ${
        coverUrl
          ? `<div class="blog-detail__cover"><img src="${esc(coverUrl)}" alt="${esc(title)}" /></div>`
          : ""
      }
      <div class="blog-detail__content bn-default-styles bn-root">${sanitize(blog.content)}</div>
    `;
  }

  window.initBlogSection = initBlogSection;
  window.initBlogListing = initBlogListing;
  window.initBlogDetails = initBlogDetails;
})();
