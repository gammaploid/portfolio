document.addEventListener('DOMContentLoaded', function() {
    const projectsBtn = document.getElementById('projects-btn');
    const aboutBtn = document.getElementById('about-btn');
    const projectsSection = document.getElementById('projects');
    const aboutSection = document.getElementById('about');
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = themeToggle.querySelector('i');
    const circleCountDisplay = document.getElementById('circle-count');

    projectsBtn.addEventListener('click', () => {
        projectsSection.style.display = 'grid';
        aboutSection.style.display = 'none';
        projectsBtn.classList.add('active');
        aboutBtn.classList.remove('active');
    });

    aboutBtn.addEventListener('click', () => {
        projectsSection.style.display = 'none';
        aboutSection.style.display = 'block';
        aboutBtn.classList.add('active');
        projectsBtn.classList.remove('active');
    });

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        if (document.body.classList.contains('dark-mode')) {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        } else {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        }
        
        d3.select('#visualization-container svg').remove();
        createVisualization(currentCircleCount);
    });

    let initialCircleCount = 100;
    let visualizationCleanup = null;

    function recreateVisualization() {
        if (visualizationCleanup) {
            visualizationCleanup();
        }
        d3.select('#visualization-container svg').remove();
        visualizationCleanup = createVisualization(initialCircleCount);
    }

    themeToggle.addEventListener('click', () => {
        recreateVisualization();
    });

    recreateVisualization();

    window.addEventListener('resize', debounce(() => {
        recreateVisualization();
    }, 250));

    // Email obfuscation
    const emailBtn = document.querySelector('.say-hi-btn');
    const encodedEmail = 'bW9jLmxpYW1nQGFzb21sYS5hLm5hc3NhaA==';
    
    if (emailBtn) {
        emailBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const email = deobfuscateEmail(encodedEmail);
            window.location.href = 'mailto:' + email;
        });
    }
});

function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

function toRadians(angle) {
    return angle * (Math.PI / 180);
}

function deobfuscateEmail(encoded) {
    return atob(encoded).split('').reverse().join('');
}

let animationFrameId = null;
let currentCircleCount = 100;
let targetCircleCount = 600;

function createVisualization(initialCount) {
    const container = document.getElementById('visualization-container');
    if (!container) return null;

    const width = Math.min(500, container.clientWidth);
    const height = container.clientHeight;

    const svg = d3.select('#visualization-container')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('margin', 'auto');

    const strokeColor = document.body.classList.contains('dark-mode') ? "#ffffff" : "#000000";
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;

    let currentCount = initialCount;
    let targetCount = initialCount;
    let animationFrameId = null;

    function updateSvg(count, duration = 300) {
        const angles = Array.from({length: Math.max(1, Math.round(count))}, (_, i) => (360 / Math.max(1, count)) * i);
        const circles = svg.selectAll(".circle").data(angles, (d, i) => i);

        circles.exit()
            .transition()
            .duration(duration)
            .attr("r", 0)
            .remove();

        const enterCircles = circles.enter()
            .append("circle")
            .attr("class", "circle")
            .attr("fill", "none")
            .attr("stroke", strokeColor)
            .attr("stroke-width", 0.5)
            .attr("r", 0)
            .attr("cx", d => d < 180 ? centerX + Math.sin(toRadians(d)) * radius * 0.5 : centerX - Math.sin(toRadians(d - 180)) * radius * 0.5)
            .attr("cy", d => d < 180 ? centerY - radius + d / 180 * height : centerY + radius - (d - 180) / 180 * height);

        circles.merge(enterCircles)
            .transition()
            .duration(duration)
            .ease(d3.easeCubicInOut)
            .attr("r", radius)
            .attr("cx", d => d < 180 ? centerX + Math.sin(toRadians(d)) * radius * 0.5 : centerX - Math.sin(toRadians(d - 180)) * radius * 0.5)
            .attr("cy", d => d < 180 ? centerY - radius + d / 180 * height : centerY + radius - (d - 180) / 180 * height);
    }

    function animate() {
        if (Math.abs(currentCount - targetCount) < 0.5) {
            updateSvg(currentCount);
            animationFrameId = null;
            return;
        }

        currentCount += (targetCount - currentCount) * 0.008;
        updateSvg(currentCount);
        animationFrameId = requestAnimationFrame(animate);
    }

    const href = atob('aHR0cHM6Ly9oYXNzYW4ud29ya3MvcmVwb3J0Lmh0bWw=');
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.head.appendChild(a);

    function handleMouseMove(event) {
        handleInteraction(event.clientX, event.clientY);
    }

    function handleMouseLeave() {}

    function handleTouchStart(event) {
        const touch = event.touches[0];
        handleInteraction(touch.clientX, touch.clientY);
    }

    function handleTouchMove(event) {
        event.preventDefault();
        const touch = event.touches[0];
        handleInteraction(touch.clientX, touch.clientY);
    }

    function handleTouchEnd(event) {}

    function handleInteraction(clientX, clientY) {
        const rect = container.getBoundingClientRect();
        const interactionX = clientX - rect.left;
        const interactionY = clientY - rect.top;

        const clampedX = Math.max(0, Math.min(width, interactionX));
        const clampedY = Math.max(0, Math.min(height, interactionY));

        const xRatio = clampedX / width;
        const yRatio = 1 - (clampedY / height);
        targetCount = Math.max(20, Math.min(200, Math.round(20 + ((xRatio + yRatio) / 2) * 180)));

        if (!animationFrameId) {
            animate();
        }
    }

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);

    updateSvg(currentCount, 1);

    return function cleanup() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', handleMouseLeave);
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
        container.removeEventListener('touchcancel', handleTouchEnd);
    };
}