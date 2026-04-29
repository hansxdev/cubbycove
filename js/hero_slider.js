document.addEventListener('DOMContentLoaded', () => {
    const sliders = document.querySelectorAll('.hero-slider');

    sliders.forEach(slider => {
        const slides = slider.querySelectorAll('.slide');
        let currentSlide = 0;
        const intervalTime = 3000; // 3 seconds

        if (slides.length === 0) return;

        setInterval(() => {
            // Hide current
            slides[currentSlide].classList.remove('opacity-100');
            slides[currentSlide].classList.add('opacity-0');

            // Calculate next
            currentSlide = (currentSlide + 1) % slides.length;

            // Show next
            slides[currentSlide].classList.remove('opacity-0');
            slides[currentSlide].classList.add('opacity-100');
        }, intervalTime);
    });
});
