"use client";

import { useEffect } from 'react';
import { REF_STORAGE_KEY } from '@/data/bdLocations';

/** Remembers the referral code from a `?ref=CODE` link so registration can use it later. */
export default function ReferralCapture() {
    useEffect(() => {
        try {
            const code = new URLSearchParams(window.location.search).get('ref');
            if (code && /^[A-Za-z0-9_-]{3,30}$/.test(code)) localStorage.setItem(REF_STORAGE_KEY, code.toUpperCase());
        } catch { /* storage blocked — the register form still accepts the code by hand */ }
    }, []);
    return null;
}
