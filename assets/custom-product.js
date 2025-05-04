document.addEventListener('DOMContentLoaded', () => {
    init();
});

function init() {
    updateSoldClasses();
    initOptionListeners();
    initQuantityAndCart();
    initValidationField();
    applyCheckedClasses();
    initCustomCheckoutButton();
}

function getVariantsFromDOM() {
    try {
        const raw = document.querySelector('#product-info')?.dataset?.variants;
        if (!raw) return [];
        const fixed = raw.replace(/&quot;/g, '"').replace(/&apos;/g, "'");
        return JSON.parse(fixed);
    } catch (e) {
        console.error("Variant parsing error:", e);
        return [];
    }
}

function getSelectedOptions() {
    const result = [];
    document.querySelectorAll('.option-group').forEach((group, idx) => {
        const selected = group.querySelector('input:checked');
        result[idx] = selected ? selected.value : null;
    });
    return result;
}

function findMatchingVariant(selectedOptions, variants) {
    return variants.find(variant =>
        variant.options.every((opt, idx) => opt === selectedOptions[idx])
    );
}

function updateAddToCartButton(variant) {
    const btn = document.getElementById('add-to-cart');
    const wrapper = document.getElementById('dynamic-checkout-button-wrapper');
    if (!btn) return;

    if (variant?.available) {
        btn.disabled = false;
        btn.textContent = 'Add to Cart';
        if (wrapper) wrapper.style.display = 'block';
    } else {
        btn.disabled = true;
        btn.textContent = 'Sold out';
        if (wrapper) wrapper.style.display = 'none';
    }
}

function updateSoldClasses() {
    const variants = getVariantsFromDOM();
    const groups = document.querySelectorAll('.option-group');
    const currentSelection = getSelectedOptions();

    groups.forEach((group, groupIndex) => {
        const optionName = group.querySelector('strong')?.textContent?.trim().toLowerCase();
        if (optionName === 'type') return;

        const radios = group.querySelectorAll('input');
        radios.forEach(input => {
            const testOptions = [...currentSelection];
            testOptions[groupIndex] = input.value;

            const exists = variants.some(variant =>
                variant.available &&
                variant.options.every((opt, idx) =>
                    testOptions[idx] === null || testOptions[idx] === opt
                )
            );

            const label = input.closest('label');
            if (label) {
                label.classList.toggle('sold', !exists);
            }
        });
    });
}

function applyCheckedClasses() {
    document.querySelectorAll('.option-group').forEach(group => {
        group.querySelectorAll('label').forEach(label => {
            label.classList.remove('checked');
        });

        const selected = group.querySelector('input:checked');
        if (selected) {
            const label = selected.closest('label');
            if (label) {
                label.classList.add('checked');
            }
        }
    });
}

function initOptionListeners() {
    const radios = document.querySelectorAll('#variant-form input[type="radio"]');
    if (!radios.length) return;

    radios.forEach(input => {
        input.addEventListener('change', async () => {
            applyCheckedClasses();

            const selectedOptions = getSelectedOptions();
            const variants = getVariantsFromDOM();
            const matchedVariant = findMatchingVariant(selectedOptions, variants);
            if (!matchedVariant) return;

            const url = new URL(window.location.href);
            url.searchParams.set('variant', matchedVariant.id);
            window.history.replaceState({}, '', url);

            const sectionId = document.getElementById('product-info-wrapper')?.dataset?.sectionId;
            if (!sectionId) return;

            try {
                const response = await fetch(`${url.pathname}?sections=${sectionId}&variant=${matchedVariant.id}`);
                const data = await response.json();
                const parser = new DOMParser();
                const doc = parser.parseFromString(data[sectionId], 'text/html');
                const newProductInfo = doc.querySelector('#product-info');
                const oldProductInfo = document.querySelector('#product-info');

                if (newProductInfo && oldProductInfo) {
                    oldProductInfo.replaceWith(newProductInfo);
                    init();
                }
            } catch (e) {
                console.error('Section loading error:', e);
            }
        });
    });
}

function initQuantityAndCart() {
    const qtyInput = document.getElementById('quantity');
    const getQty = () => parseInt(qtyInput?.value || '1');

    function replaceWithClone(id, onClick) {
        const el = document.getElementById(id);
        if (!el) return;
        const newEl = el.cloneNode(true);
        el.parentNode?.replaceChild(newEl, el);
        if (onClick) newEl.addEventListener('click', onClick);
    }

    replaceWithClone('increase-qty', () => {
        if (!qtyInput) return;
        qtyInput.value = getQty() + 1;
    });

    replaceWithClone('decrease-qty', () => {
        if (!qtyInput) return;
        qtyInput.value = Math.max(1, getQty() - 1);
    });

    replaceWithClone('add-to-cart', async () => {
        if (!validateUserForm()) return;

        const button = document.getElementById('add-to-cart');
        if (!button) return;

        button.classList.add('custom-loading');

        const variants = getVariantsFromDOM();
        const selectedOptions = getSelectedOptions();
        const matchedVariant = findMatchingVariant(selectedOptions, variants);

        updateAddToCartButton(matchedVariant);
        if (!matchedVariant || !matchedVariant.available) return;

        const quantity = getQty();
        const properties = getCustomProperties();

        try {
            const res = await fetch('/cart/add.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: matchedVariant.id, quantity, properties })
            });

            const msg = document.getElementById('add-to-cart-message');
            if (msg) {
                msg.textContent = res.ok ? 'Product added to cart!' : 'Error while adding.';
                msg.style.display = 'block';
            }

            if (res.ok) updateCartCount();
        } catch (e) {
            console.error('Cart add error:', e);
        } finally {
            button.classList.remove('custom-loading');
            setTimeout(() => {
                const msg = document.getElementById('add-to-cart-message');
                if (msg) msg.style.display = 'none';
            }, 1500);
        }
    });

    replaceWithClone('go-to-checkout', async () => {
        if (!validateUserForm()) return;

        const variants = getVariantsFromDOM();
        const selectedOptions = getSelectedOptions();
        const matchedVariant = findMatchingVariant(selectedOptions, variants);

        if (!matchedVariant || !matchedVariant.available) return;

        const quantity = getQty();
        const properties = getCustomProperties();

        try {
            const res = await fetch('/cart/add.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: matchedVariant.id, quantity, properties })
            });

            if (res.ok) {
                window.location.href = '/checkout';
            }
        } catch (e) {
            console.error('Checkout error:', e);
        }
    });

    const variants = getVariantsFromDOM();
    const selectedOptions = getSelectedOptions();
    const matchedVariant = findMatchingVariant(selectedOptions, variants);
    updateAddToCartButton(matchedVariant);
}

function validateUserForm() {
    const form = document.getElementById('user-form');
    if (!form) return true;
    const inputs = form.querySelectorAll('[required]');
    let isValid = true;

    inputs.forEach(input => {
        if (!input.value.trim()) {
            input.classList.add('field-error');
            isValid = false;
        }
    });

    return isValid;
}

function initValidationField() {
    const form = document.getElementById('user-form');
    if (!form) return;
    form.querySelectorAll('[required]').forEach(input => {
        const handler = () => {
            if (input.value.trim()) {
                input.classList.remove('field-error');
            }
        };
        input.addEventListener('input', handler);
        input.addEventListener('change', handler);
    });
}

function getCustomProperties() {
    const props = {};
    document.querySelectorAll('[name^="properties["]').forEach(el => {
        const match = el.name.match(/properties\[(.+?)\]/);
        if (!match) return;
        const key = match[1];
        let value = el.value;
        if (el.type === 'radio' && !el.checked) return;
        if (el.tagName.toLowerCase() === 'select') {
            value = el.options[el.selectedIndex]?.value || '';
        }
        if (value) props[key] = value;
    });
    return props;
}

async function updateCartCount() {
    try {
        const cart = await fetch('/cart.js').then(res => res.json());
        const totalCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

        let bubble = document.querySelector('.cart-count-bubble');
        if (!bubble) {
            bubble = document.createElement('div');
            bubble.className = 'cart-count-bubble';
            bubble.innerHTML = `<span aria-hidden="true">0</span><span class="visually-hidden">0 items</span>`;
            document.querySelector('.header__icon--cart')?.appendChild(bubble);
        }

        const bubbleVisible = bubble.querySelector('span[aria-hidden="true"]');
        if (bubbleVisible) bubbleVisible.textContent = totalCount;

        const bubbleHidden = bubble.querySelector('.visually-hidden');
        if (bubbleHidden) bubbleHidden.textContent = `${totalCount} items`;

        bubble.style.display = totalCount > 0 ? 'block' : 'none';
    } catch (e) {
        console.error('Cart count update error:', e);
    }
}

function initCustomCheckoutButton() {
    const btn = document.getElementById('go-to-checkout');
    if (!btn) return;

    btn.addEventListener('click', () => {
        if (!validateUserForm()) return;

        const quantity = parseInt(document.getElementById('quantity')?.value || '1');
        const selectedOptions = getSelectedOptions();
        const variants = getVariantsFromDOM();
        const matchedVariant = findMatchingVariant(selectedOptions, variants);

        if (!matchedVariant || !matchedVariant.available) {
            alert("Selected variant is not available");
            return;
        }

        const checkoutURL = `/cart/${matchedVariant.id}:${quantity}`;
        window.location.href = checkoutURL;
    });
}