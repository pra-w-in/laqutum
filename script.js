/* ================================================
   AptitudePro — JavaScript
   Animations, Interactions & Dynamic Behavior
   ================================================ */

document.addEventListener('DOMContentLoaded', () => {

    // ---------- Floating Particles ----------
    const particlesContainer = document.getElementById('particles');
    const particleCount = 35;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        const size = Math.random() * 4 + 1;
        const left = Math.random() * 100;
        const duration = Math.random() * 15 + 10;
        const delay = Math.random() * 15;
        const hue = 260 + Math.random() * 40;

        particle.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            left: ${left}%;
            animation-duration: ${duration}s;
            animation-delay: ${delay}s;
            background: hsl(${hue}, 70%, 60%);
            filter: blur(${size > 3 ? 1 : 0}px);
        `;
        particlesContainer.appendChild(particle);
    }

    // ---------- Navbar Scroll Effect & Throttling ----------
    const navbar = document.getElementById('navbar');
    let isScrolling = false;

    const handleScroll = () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    };

    // ---------- Mobile Menu Toggle ----------
    const mobileToggle = document.getElementById('mobileToggle');
    const navLinks = document.getElementById('navLinks');

    mobileToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        mobileToggle.classList.toggle('active');
    });

    // Close mobile menu when clicking a link
    navLinks.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            mobileToggle.classList.remove('active');
        });
    });

    // ---------- Animated Counters ----------
    const counters = document.querySelectorAll('.stat-number[data-target]');
    let countersAnimated = false;

    const animateCounters = () => {
        if (countersAnimated) return;

        const heroStats = document.querySelector('.hero-stats');
        if (!heroStats) return;

        const rect = heroStats.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
            countersAnimated = true;

            counters.forEach(counter => {
                const target = parseInt(counter.getAttribute('data-target'));
                const duration = 2000;
                const startTime = performance.now();

                const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

                const updateCounter = (currentTime) => {
                    const elapsed = currentTime - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    const easedProgress = easeOutQuart(progress);
                    const currentValue = Math.round(target * easedProgress);

                    counter.textContent = currentValue;

                    if (progress < 1) {
                        requestAnimationFrame(updateCounter);
                    }
                };

                requestAnimationFrame(updateCounter);
            });
        }
    };

    window.addEventListener('scroll', animateCounters, { passive: true });
    animateCounters();

    // ---------- Scroll Reveal Animations ----------
    const revealElements = document.querySelectorAll(
        '.pain-card, .feature-card, .topic-category, .timeline-item, .preview-card, .testimonial-card, .pricing-card, .faq-item'
    );

    const revealObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    // Stagger the animation based on sibling index
                    const parent = entry.target.parentElement;
                    const siblings = Array.from(parent.children).filter(child =>
                        child.classList.contains(entry.target.classList[0])
                    );
                    const siblingIndex = siblings.indexOf(entry.target);
                    const delay = siblingIndex * 100;

                    setTimeout(() => {
                        entry.target.classList.add('visible');
                    }, delay);

                    revealObserver.unobserve(entry.target);
                }
            });
        },
        {
            threshold: 0.15,
            rootMargin: '0px 0px -40px 0px',
        }
    );

    revealElements.forEach(el => revealObserver.observe(el));

    // ---------- FAQ Accordion ----------
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');

        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');

            // Close all other items
            faqItems.forEach(otherItem => {
                otherItem.classList.remove('active');
            });

            // Toggle current item
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });

    // ---------- Smooth Scroll for Anchor Links ----------
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            const targetId = anchor.getAttribute('href');
            if (targetId === '#') return;

            const targetEl = document.querySelector(targetId);
            if (targetEl) {
                e.preventDefault();
                targetEl.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                });
            }
        });
    });

    // ---------- Active Nav Link Highlight ----------
    const sections = document.querySelectorAll('section[id]');

    const highlightNav = () => {
        const scrollY = window.scrollY + 120;

        sections.forEach(section => {
            const top = section.offsetTop;
            const height = section.offsetHeight;
            const id = section.getAttribute('id');

            if (scrollY >= top && scrollY < top + height) {
                // Top nav
                const topLink = document.querySelector(`.nav-link[href="#${id}"]`);
                if (topLink) topLink.style.color = 'var(--accent-3)';

                // Bottom nav
                const bottomLink = document.querySelector(`.bottom-nav-item[href="#${id}"]`);
                if (bottomLink) bottomLink.classList.add('active');
            } else {
                // Top nav
                const topLink = document.querySelector(`.nav-link[href="#${id}"]`);
                if (topLink) topLink.style.color = '';

                // Bottom nav
                const bottomLink = document.querySelector(`.bottom-nav-item[href="#${id}"]`);
                if (bottomLink) bottomLink.classList.remove('active');
            }
        });
    };

    // Unified scroll listener with rAF throttle
    window.addEventListener('scroll', () => {
        if (!isScrolling) {
            window.requestAnimationFrame(() => {
                handleScroll();
                highlightNav();
                isScrolling = false;
            });
            isScrolling = true;
        }
    }, { passive: true });
    
    // Initial triggers
    handleScroll();
    highlightNav();

    // ---------- Pricing Card Hover Tilt ----------
    const pricingCards = document.querySelectorAll('.pricing-card');

    pricingCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (y - centerY) / 30;
            const rotateY = (centerX - x) / 30;

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) ${
                card.classList.contains('pricing-card-featured') ? 'scale(1.04)' : ''
            }`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = card.classList.contains('pricing-card-featured') ? 'scale(1.04)' : '';
        });
    });

    // ---------- Launch Preview on "See Preview" buttons ----------
    // Init the preview engine (registers internal button listeners)
    if (typeof PreviewApp !== 'undefined') {
        PreviewApp.init();

        const handleStartApp = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            if (typeof AuthManager !== 'undefined' && !AuthManager.getCurrentUser()) {
                AuthManager.openAuthModal(() => {
                    if (typeof PreviewApp !== 'undefined') PreviewApp.open();
                });
            } else {
                if (typeof PreviewApp !== 'undefined') PreviewApp.open();
            }
        };

        // Wire every preview / CTA button across landing page
        document.querySelectorAll('a[href="#preview"], .nav-cta, .dash-btn-black, .slide-btn').forEach(link => {
            link.addEventListener('click', handleStartApp);
        });
    }
    // ---------- Dashboard Banner Slider ----------
    const track = document.getElementById('dashSlider');
    const dotsContainer = document.getElementById('sliderDots');
    if (track && dotsContainer) {
        const slides = track.querySelectorAll('.dash-slider-slide');
        let currentSlide = 0;
        const totalSlides = slides.length;

        // Create dots
        slides.forEach((_, i) => {
            const dot = document.createElement('div');
            dot.classList.add('slider-dot');
            if (i === 0) dot.classList.add('active');
            dotsContainer.appendChild(dot);
        });
        const dots = dotsContainer.querySelectorAll('.slider-dot');

        const updateSlider = () => {
            track.style.transform = `translateX(-${currentSlide * 100}%)`;
            dots.forEach(d => d.classList.remove('active'));
            if (dots[currentSlide]) dots[currentSlide].classList.add('active');
        };

        // Auto slide every 4 seconds
        setInterval(() => {
            currentSlide = (currentSlide + 1) % totalSlides;
            updateSlider();
        }, 4000);
    }

});
