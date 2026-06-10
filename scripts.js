        // DEVICE DETECTION - Mobil cihaz algılama
        function detectMobileDevice() {
            const userAgent = navigator.userAgent || navigator.vendor || window.opera;
            
            // Mobil cihaz kontrolü
            const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
            
            // Touch desteği kontrolü
            const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            
            // Ekran genişliği kontrolü (768px altı)
            const isSmallScreen = window.innerWidth <= 768;
            
            return (isMobile || hasTouch) && isSmallScreen;
        }

        // Mobil cihaz ise body'ye class ekle ve mobil CSS'i yükle
        if (detectMobileDevice()) {
            document.body.classList.add('mobile-device');
            
            // Mobil CSS dosyasını dinamik olarak yükle
            const mobileCSS = document.createElement('link');
            mobileCSS.rel = 'stylesheet';
            mobileCSS.href = 'mobile-styles.css';
            document.head.appendChild(mobileCSS);

            const mobileThemeCSS = document.createElement('link');
            mobileThemeCSS.rel = 'stylesheet';
            mobileThemeCSS.href = 'mobile-theme-refresh.css';
            document.head.appendChild(mobileThemeCSS);
            
            console.log('📱 Mobil cihaz algılandı - Optimize edilmiş deneyim yüklendi');
            
            // Test banner'ı göster (TEST AMAÇLI - İSTERSEN KALDIRILIR)
            showDeviceInfoBanner('Mobil Deneyim Aktif');
        } else {
            console.log('💻 Masaüstü cihaz algılandı - Standart deneyim yüklendi');
            
            // Test banner'ı göster (TEST AMAÇLI - İSTERSEN KALDIRILIR)
            showDeviceInfoBanner('Masaüstü Deneyim Aktif');
        }
        
        // Test banner fonksiyonu
        function showDeviceInfoBanner(message) {
            // CSS dosyasını yükle
            const bannerCSS = document.createElement('link');
            bannerCSS.rel = 'stylesheet';
            bannerCSS.href = 'device-info.css';
            document.head.appendChild(bannerCSS);
            
            // Banner oluştur
            const banner = document.createElement('div');
            banner.className = 'device-info-banner';
            banner.innerHTML = message + ' <span class="close-banner"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></line><line x1="6" y1="6" x2="18" y2="18" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></line></svg></span>';
            document.body.appendChild(banner);
            
            // Banner'ı göster
            setTimeout(() => banner.style.display = 'block', 100);
            
            // Kapatma butonu
            banner.querySelector('.close-banner').addEventListener('click', function() {
                banner.classList.add('fade-out');
                setTimeout(() => banner.remove(), 500);
            });
            
            // 10 saniye sonra otomatik kapat
            setTimeout(() => {
                if (banner.parentElement) {
                    banner.classList.add('fade-out');
                    setTimeout(() => banner.remove(), 500);
                }
            }, 10000);
        }

        // Ekran yönü değişiminde kontrol et
        window.addEventListener('orientationchange', function() {
            setTimeout(function() {
                if (detectMobileDevice() && !document.body.classList.contains('mobile-device')) {
                    location.reload();
                }
            }, 500);
        });

        // Featured section carousel
        const featuredCarousel = document.querySelector('.featured .hero-carousel');
        const slides = featuredCarousel ? featuredCarousel.querySelectorAll('.carousel-slide') : [];
        const indicators = featuredCarousel ? featuredCarousel.querySelectorAll('.indicator') : [];
        let currentSlide = 0;
        let slideInterval;

        // LOADING SCREEN
        window.addEventListener('load', function() {
            const loadingScreen = document.getElementById('loadingScreen');
            
            // Hide loading screen after 5 seconds
            setTimeout(function() {
                loadingScreen.classList.add('hidden');
                
                // Remove from DOM after fade animation
                setTimeout(function() {
                    loadingScreen.style.display = 'none';
                }, 1000); // Wait for fade animation (1s)
            }, 5000); // 5 seconds
        });

        function showSlide(index) {
            // Remove active class from all slides and indicators
            slides.forEach(slide => slide.classList.remove('active'));
            indicators.forEach(indicator => indicator.classList.remove('active'));
            
            // Add active class to current slide and indicator
            slides[index].classList.add('active');
            indicators[index].classList.add('active');
            
            currentSlide = index;
        }

        function nextSlide() {
            currentSlide = (currentSlide + 1) % slides.length;
            showSlide(currentSlide);
        }

        function startSlideShow() {
            slideInterval = setInterval(nextSlide, 4000); // Change slide every 4 seconds
        }

        function stopSlideShow() {
            clearInterval(slideInterval);
        }

        // Start automatic slideshow
        if (slides.length > 0) {
            startSlideShow();
            
            // Manual navigation via indicators
            indicators.forEach((indicator, index) => {
                indicator.addEventListener('click', () => {
                    stopSlideShow();
                    showSlide(index);
                    startSlideShow(); // Restart automatic slideshow
                });
            });

            // Pause on hover
            if (featuredCarousel) {
                featuredCarousel.addEventListener('mouseenter', stopSlideShow);
                featuredCarousel.addEventListener('mouseleave', startSlideShow);
            }
        }

        // Mobile menu toggle
        const menuToggle = document.getElementById('menuToggle');
        const mobileNav = document.getElementById('mobileNav');
        const mobileNavLinks = document.querySelectorAll('.mobile-nav-links a');

        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            mobileNav.classList.toggle('active');
        });

        mobileNavLinks.forEach(link => {
            link.addEventListener('click', () => {
                menuToggle.classList.remove('active');
                mobileNav.classList.remove('active');
            });
        });

        // Navbar scroll effect and scroll spy
        const navbar = document.getElementById('navbar');
        const sections = document.querySelectorAll('section[id]');
        const navLinks = document.querySelectorAll('.nav-link');

        function updateActiveNav() {
            const scrollY = window.pageYOffset;
            const navHeight = navbar.offsetHeight;
            
            // Navbar background on scroll
            if (scrollY > 100) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
            
            // Scroll spy for active navigation
            sections.forEach(section => {
                const sectionHeight = section.offsetHeight;
                const sectionTop = section.offsetTop - navHeight - 10;
                const sectionId = section.getAttribute('id');
                
                if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
                    navLinks.forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('href') === '#' + sectionId) {
                            link.classList.add('active');
                        }
                    });
                }
            });
            
            // Special case for home when at the very top
            if (scrollY < 100) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === '#home') {
                        link.classList.add('active');
                    }
                });
            }
        }

        window.addEventListener('scroll', updateActiveNav);
        window.addEventListener('resize', updateActiveNav); // Update on resize
        updateActiveNav(); // Call on load

        // Category filter
        const tabButtons = document.querySelectorAll('.tab-btn');
        const collectionCards = document.querySelectorAll('.collection-card');

        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.dataset.category;
                
                // Update active button
                tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Filter cards
                collectionCards.forEach(card => {
                    if (card.dataset.category === category) {
                        card.style.display = 'block';
                        setTimeout(() => {
                            card.style.opacity = '1';
                            card.style.animation = 'fadeInUp 0.6s ease forwards';
                        }, 100);
                    } else {
                        card.style.opacity = '0';
                        setTimeout(() => {
                            card.style.display = 'none';
                        }, 300);
                    }
                });
            });
        });

        // Show turnuva category by default on page load
        document.addEventListener('DOMContentLoaded', () => {
            collectionCards.forEach(card => {
                if (card.dataset.category === 'turnuva') {
                    card.style.display = 'block';
                    card.style.opacity = '1';
                } else {
                    card.style.display = 'none';
                }
            });
        });

        // Smooth scroll
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const targetId = this.getAttribute('href');
                const target = document.querySelector(targetId);
                
                if (target) {
                    // Get navbar height dynamically (it changes on medium screens)
                    const navHeight = navbar.offsetHeight;
                    let offsetTop;
                    
                    // If scrolling to home, go to top
                    if (targetId === '#home') {
                        offsetTop = 0;
                    } else {
                        // For all other sections, position them right at the top of viewport
                        // just below the navbar to completely hide previous content
                        offsetTop = target.offsetTop - navHeight;
                    }
                    
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            });
        });

        // Parallax effect on scroll
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            const parallax = document.querySelector('.hero-content');
            if (parallax) {
                parallax.style.transform = `translateY(${scrolled * 0.5}px)`;
            }
        });

        // GOOGLE FORMS CONTACT FORM HANDLING
        const contactForm = document.getElementById('contactForm');
        if (contactForm) {
            contactForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formStatus = document.getElementById('formStatus');
                const submitBtn = contactForm.querySelector('.form-submit');
                const originalText = submitBtn.textContent;
                
                // Show loading state
                submitBtn.textContent = 'Gönderiliyor...';
                submitBtn.disabled = true;
                formStatus.className = 'form-status loading';
                formStatus.textContent = 'Mesajınız gönderiliyor...';
                
                // Get form data
                const name = document.getElementById('name').value;
                const phone = document.getElementById('phone').value;
                const email = document.getElementById('email').value || 'Belirtilmedi';
                const message = document.getElementById('message').value;
                
                // Google Forms URL - BU URL'İ KENDİ GOOGLE FORMS URL'İNİZLE DEĞİŞTİRİN
                const GOOGLE_FORM_URL = 'https://docs.google.com/forms/u/0/d/e/1FAIpQLSdV4BvPCUK6M8YHPHoQhWU6P3qVlHqz_BQsMcI3uow8bqB1zg/formResponse';
                
                // Google Forms field IDs - BU ID'LERİ KENDİ FORM FIELD ID'LERİNİZLE DEĞİŞTİRİN
                const formData = new FormData();
                formData.append('entry.377811178', name);
                formData.append('entry.423922995', phone);
                formData.append('entry.903437187', email);
                formData.append('entry.461673012', message);
                
                try {
                    // Send to Google Forms
                    await fetch(GOOGLE_FORM_URL, {
                        method: 'POST',
                        mode: 'no-cors', // Google Forms requires no-cors
                        body: formData
                    });
                    
                    // Show success message
                    submitBtn.textContent = 'Gönderildi!';
                    submitBtn.style.background = '#4CAF50';
                    formStatus.className = 'form-status success';
                    formStatus.textContent = 'Mesajınız başarıyla gönderildi! En kısa sürede size dönüş yapacağız.';
                    
                    // Reset form
                    contactForm.reset();
                    
                    // Reset button after 3 seconds
                    setTimeout(() => {
                        submitBtn.textContent = originalText;
                        submitBtn.style.background = '';
                        submitBtn.disabled = false;
                        formStatus.style.display = 'none';
                    }, 5000);
                    
                } catch (error) {
                    // Show error message
                    submitBtn.textContent = 'Hata! Tekrar Deneyin';
                    submitBtn.style.background = '#f44336';
                    formStatus.className = 'form-status error';
                    formStatus.textContent = 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.';
                    
                    // Reset button after 3 seconds
                    setTimeout(() => {
                        submitBtn.textContent = originalText;
                        submitBtn.style.background = '';
                        submitBtn.disabled = false;
                    }, 3000);
                }
            });
        }

        // Form input animations
        const formInputs = document.querySelectorAll('.form-group input, .form-group textarea');
        formInputs.forEach(input => {
            input.addEventListener('focus', () => {
                input.parentElement.style.transform = 'translateY(-2px)';
            });
            input.addEventListener('blur', () => {
                input.parentElement.style.transform = '';
            });
        });

        // Intersection Observer for animations
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.animation = 'fadeInUp 0.8s ease forwards';
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        document.querySelectorAll('.featured-container, .contact-content').forEach(el => {
            observer.observe(el);
        });

        // Team Carousel Navigation
        const teamCarousel = document.getElementById('teamCarousel');
        const teamPrevBtn = document.getElementById('teamPrev');
        const teamNextBtn = document.getElementById('teamNext');

        if (teamCarousel && teamPrevBtn && teamNextBtn) {
            const scrollAmount = 310; // Card width + gap

            teamPrevBtn.addEventListener('click', () => {
                teamCarousel.scrollBy({
                    left: -scrollAmount,
                    behavior: 'smooth'
                });
            });

            teamNextBtn.addEventListener('click', () => {
                teamCarousel.scrollBy({
                    left: scrollAmount,
                    behavior: 'smooth'
                });
            });

            // Mouse drag to scroll
            let isDown = false;
            let startX;
            let scrollLeft;

            teamCarousel.addEventListener('mousedown', (e) => {
                isDown = true;
                teamCarousel.style.cursor = 'grabbing';
                startX = e.pageX - teamCarousel.offsetLeft;
                scrollLeft = teamCarousel.scrollLeft;
            });

            teamCarousel.addEventListener('mouseleave', () => {
                isDown = false;
                teamCarousel.style.cursor = 'grab';
            });

            teamCarousel.addEventListener('mouseup', () => {
                isDown = false;
                teamCarousel.style.cursor = 'grab';
            });

            teamCarousel.addEventListener('mousemove', (e) => {
                if (!isDown) return;
                e.preventDefault();
                const x = e.pageX - teamCarousel.offsetLeft;
                const walk = (x - startX) * 2;
                teamCarousel.scrollLeft = scrollLeft - walk;
            });

            // Touch support for mobile
            let touchStartX = 0;
            let touchScrollLeft = 0;

            teamCarousel.addEventListener('touchstart', (e) => {
                touchStartX = e.touches[0].pageX;
                touchScrollLeft = teamCarousel.scrollLeft;
            });

            teamCarousel.addEventListener('touchmove', (e) => {
                const touchX = e.touches[0].pageX;
                const walk = (touchStartX - touchX) * 2;
                teamCarousel.scrollLeft = touchScrollLeft + walk;
            });
        }

// Popup Functions
function openPopup(popupId) {
    const popup = document.getElementById(popupId);
    if (!popup) {
        return;
    }

    popup.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closePopup(popupId) {
    const popup = document.getElementById(popupId);
    if (!popup) {
        return;
    }

    popup.classList.remove('active');

    // Re-enable scroll if no popup is active
    if (!document.querySelector('.popup-overlay.active')) {
        document.body.style.overflow = '';
    }
}

function showOCDPopup() {
    openPopup('ocdPopup');
}

function closeOCDPopup() {
    closePopup('ocdPopup');
}

function showAgoraPopup() {
    openPopup('agoraPopup');
}

function closeAgoraPopup() {
    closePopup('agoraPopup');
}

function showCGMPopup() {
    openPopup('cgmPopup');
}

function closeCGMPopup() {
    closePopup('cgmPopup');
}

// Wait for DOM to load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPopups);
} else {
    initPopups();
}

function initPopups() {
    const popupIds = ['agoraPopup', 'ocdPopup', 'cgmPopup'];

    popupIds.forEach((popupId) => {
        const popup = document.getElementById(popupId);
        if (!popup) {
            return;
        }

        // Close popup when clicking outside
        popup.addEventListener('click', function(e) {
            if (e.target === popup) {
                closePopup(popupId);
            }
        });
    });

    // Close popup with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' || e.key === 'Esc') {
            popupIds.forEach((popupId) => closePopup(popupId));
        }
    });
}
