import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { useTheme } from '@/app/providers/ThemeContext';

export function useAndroidNativeBridge(): void {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();

  // Status Bar adaptation for theme changes
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    async function applyStatusBar() {
      try {
        if (theme === 'dark') {
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#0D1B2A' });
        } else {
          await StatusBar.setStyle({ style: Style.Light });
          await StatusBar.setBackgroundColor({ color: '#FFFFFF' });
        }
      } catch (err) {
        // Status bar plugin may throw on unsupported platforms
      }
    }

    applyStatusBar();
  }, [theme]);

  // Back button and AppUrlOpen (Deep Links) handling
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // 1. Android Back Button listener
    const backListener = CapApp.addListener('backButton', () => {
      // Check if any modal is currently open in the DOM
      const modalCloseButtons = document.querySelectorAll<HTMLButtonElement>('[data-modal-close]');
      if (modalCloseButtons.length > 0) {
        const topModalClose = modalCloseButtons[modalCloseButtons.length - 1];
        topModalClose.click();
        return;
      }

      // If on root or login page, exit application
      if (location.pathname === '/' || location.pathname === '/login') {
        CapApp.exitApp();
      } else {
        navigate(-1);
      }
    });

    // 2. App URL Open listener (Deep links & app links)
    const urlListener = CapApp.addListener('appUrlOpen', (event) => {
      try {
        const rawUrl = event.url;
        // Format 1: https://k-692.github.io/Splitify/join/<token>
        if (rawUrl.includes('/join/')) {
          const parts = rawUrl.split('/join/');
          const token = parts[1]?.split(/[?#]/)[0];
          if (token) {
            navigate(`/join/${token}`);
            return;
          }
        }

        // Format 2: splitify://join/<token>
        const parsed = new URL(rawUrl);
        if (parsed.protocol === 'splitify:' && (parsed.host === 'join' || parsed.pathname.includes('/join/'))) {
          const token = parsed.host === 'join'
            ? parsed.pathname.replace(/^\//, '').split(/[?#]/)[0]
            : parsed.pathname.split('/join/')[1]?.split(/[?#]/)[0];
          if (token) {
            navigate(`/join/${token}`);
          }
        }
      } catch (err) {
        console.warn('[Splitify] Error handling deep link:', err);
      }
    });

    return () => {
      backListener.then((h) => h.remove());
      urlListener.then((h) => h.remove());
    };
  }, [navigate, location.pathname]);
}
