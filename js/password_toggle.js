(function () {
    const INIT_ATTR = 'data-password-toggle-bound';

    function ensureStyles() {
        if (document.getElementById('cc-password-toggle-styles')) return;

        const style = document.createElement('style');
        style.id = 'cc-password-toggle-styles';
        style.textContent = `
            .cc-password-toggle-wrap {
                position: relative;
                display: block;
            }
            .cc-password-toggle-btn {
                position: absolute;
                right: 0.75rem;
                top: 50%;
                transform: translateY(-50%);
                background: transparent;
                border: 0;
                padding: 0;
                margin: 0;
                line-height: 1;
                color: inherit;
                opacity: 0.65;
                cursor: pointer;
            }
            .cc-password-toggle-btn:hover,
            .cc-password-toggle-btn:focus-visible {
                opacity: 1;
            }
        `;
        document.head.appendChild(style);
    }

    function setIcon(button, isVisible) {
        const icon = button.querySelector('i');
        if (!icon) return;

        icon.classList.remove('fa-eye', 'fa-eye-slash');
        icon.classList.add(isVisible ? 'fa-eye-slash' : 'fa-eye');

        const label = isVisible ? 'Hide password' : 'Show password';
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
    }

    function ensureInputPadding(input) {
        const current = parseFloat(window.getComputedStyle(input).paddingRight || '0');
        if (Number.isFinite(current) && current < 40) {
            input.style.paddingRight = '2.75rem';
        }
    }

    function attachToggle(input) {
        if (!input || input.getAttribute(INIT_ATTR) === 'true') return;

        const wrapper = document.createElement('span');
        wrapper.className = 'cc-password-toggle-wrap';

        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cc-password-toggle-btn';
        button.innerHTML = '<i class="fa-solid fa-eye" aria-hidden="true"></i>';

        button.addEventListener('click', function () {
            const isHidden = input.type === 'password';
            input.type = isHidden ? 'text' : 'password';
            setIcon(button, input.type === 'text');
        });

        wrapper.appendChild(button);
        ensureInputPadding(input);
        setIcon(button, false);

        input.setAttribute(INIT_ATTR, 'true');
    }

    function scanAndAttach(root) {
        const scope = root || document;
        scope.querySelectorAll('input[type="password"]').forEach(attachToggle);
    }

    function startObserver() {
        if (!document.body || window.__ccPasswordToggleObserver) return;

        const observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    if (!(node instanceof Element)) return;
                    if (node.matches('input[type="password"]')) {
                        attachToggle(node);
                    }
                    if (node.querySelectorAll) {
                        node.querySelectorAll('input[type="password"]').forEach(attachToggle);
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
        window.__ccPasswordToggleObserver = observer;
    }

    function initPasswordToggles() {
        ensureStyles();
        scanAndAttach(document);
        startObserver();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPasswordToggles);
    } else {
        initPasswordToggles();
    }
})();
