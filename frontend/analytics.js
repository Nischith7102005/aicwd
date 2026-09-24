/**
 * Monitr.ai — shared GA4 helpers (measurement ID: G-FK3PF0KZ2R)
 *
 * Every page already boots gtag.js in the <head>. This file adds two small
 * wrappers used by the key.html -> dashboard.html flow:
 *
 *   window.trackEvent(name, params)   ->  gtag('event', name, params)
 *   window.trackUser(properties)      ->  gtag('set', 'user_properties', ...)
 *
 * ── Security / privacy note ─────────────────────────────────────────────
 * An API key is a live credential that can be billed against the person who
 * owns it. Google Analytics is a third-party sink: GA4's terms forbid sending
 * confidential data to it, and anything in a GA payload is visible to every
 * user of that GA property (and to Google). So key material is NEVER forwarded
 * here — not raw, not truncated, not masked.
 *
 * That rule is enforced structurally rather than by comment:
 *   1. only parameter names on the SAFE_PARAMS allowlist are forwarded, so a
 *      stray `apiKey` field in a caller is silently dropped;
 *   2. opaque, secret-looking string values are dropped even if a safe name is
 *      used;
 *   3. string values longer than 64 chars are dropped.
 *
 * Describe a submitted key with `key_length` / `key_length_bucket` instead —
 * those are on the allowlist. The raw key itself is never sent to analytics.
 * This local demo flow does not send credentials to a remote configuration service.
 */
(function () {
    'use strict';

    // Parameter names that are safe to send to GA4. Anything not listed here
    // is dropped before the event leaves the page.
    const SAFE_PARAMS = [
        'provider',
        'provider_name',
        'model',
        'method',
        'result',
        'reason',
        'source',
        'step',
        'page',
        'demo_mode',
        'auto_detected',
        'provider_mode',
        'key_length',
        'key_length_bucket',
        'has_api_key',
        'target_provider',
    ];

    // e.g. "sk-proj-abc123...", "AIzaSy...", a Firebase uid, a bearer token.
    const SECRET_LIKE = /^[A-Za-z0-9_\-.]{20,}$/;

    function isSafeValue(value) {
        if (typeof value === 'number') return Number.isFinite(value);
        if (typeof value === 'boolean') return true;
        if (typeof value !== 'string') return false;
        if (value.length === 0 || value.length > 64) return false;
        // Long opaque strings are almost always credentials — never ship them.
        if (SECRET_LIKE.test(value)) return false;
        return true;
    }

    function sanitize(params) {
        const safe = {};
        Object.keys(params || {}).forEach((name) => {
            if (SAFE_PARAMS.indexOf(name) === -1) {
                console.warn(`[analytics] dropped non-allowlisted param "${name}"`);
                return;
            }
            if (!isSafeValue(params[name])) return;
            safe[name] = params[name];
        });
        return safe;
    }

    // gtag() exists from the inline snippet in each page's <head>, but fall
    // back to the dataLayer queue so events are never lost if it does not.
    function gtagSafe() {
        if (typeof window.gtag === 'function') {
            window.gtag.apply(null, arguments);
            return;
        }
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(arguments);
    }

    /**
     * Send a GA4 event. `transport_type: 'beacon'` keeps the hit alive across
     * the key.html -> dashboard.html navigation.
     */
    function trackEvent(name, params) {
        gtagSafe('event', name, Object.assign({ transport_type: 'beacon' }, sanitize(params)));
    }

    /** Attach non-identifying user properties (segments funnels in GA4). */
    function trackUser(properties) {
        gtagSafe('set', 'user_properties', sanitize(properties));
    }

    /** Coarse length bucket — reports "a key was entered" without the key. */
    function keyLengthBucket(length) {
        if (!length) return 'empty';
        if (length < 10) return '1-9';
        if (length < 20) return '10-19';
        if (length < 40) return '20-39';
        if (length < 80) return '40-79';
        return '80+';
    }

    window.trackEvent = trackEvent;
    window.trackUser = trackUser;
    window.keyLengthBucket = keyLengthBucket;
})();
