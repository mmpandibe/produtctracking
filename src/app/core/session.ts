import { Injectable, inject, signal } from '@angular/core';
import { ApiError, api, isNoBackend } from './api';
import { DataStore } from './data-store';
import type { DataState, User } from './models';

/**
 * local: no server found → the Phase A demo running on this browser's storage
 * signed_out: the server is there but nobody is signed in → login page
 * remote: signed in; data comes from and is saved to the server
 * change_password: signed in with a password an admin set; only the change-password page is available
 */
export type SessionMode = 'local' | 'signed_out' | 'remote' | 'change_password';

interface MeResponse {
  user: User;
  capabilities: string[];
  features: { demoSwitcher: boolean };
}

/** Step 18b: works out at start-up whether nPro talks to the .NET API, and handles sign-in / sign-out. */
@Injectable({ providedIn: 'root' })
export class Session {
  private readonly store = inject(DataStore);

  readonly mode = signal<SessionMode>('local');
  /** The demo "Sign in as" switcher (server setting Features:DemoSwitcher; always on in local mode) */
  readonly demoSwitcher = signal(true);

  /** Called once before the app renders (provideAppInitializer) */
  async init() {
    try {
      await this.loadSignedIn();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        this.mode.set('signed_out');
        return;
      }
      if (isNoBackend(err)) {
        this.mode.set('local');
        return;
      }
      // The server answered with an error: show the login page rather than stale local data
      console.error('nPro API problem', err);
      this.mode.set('signed_out');
    }
  }

  private async loadSignedIn() {
    const me = await api<MeResponse>('GET', '/api/auth/me');
    this.demoSwitcher.set(me.features.demoSwitcher);
    // The server refuses data until the person replaces an admin-set password
    if (me.user.mustChangePassword) {
      this.mode.set('change_password');
      return;
    }
    this.store.hydrate(await api<DataState>('GET', '/api/state'));
    this.mode.set('remote');
  }

  /** `login` is a work email or an in-house employee ID */
  async login(login: string, password: string) {
    await api('POST', '/api/auth/login', { login: login.trim(), password });
    // /me after signing in also issues a security token for the new session
    await this.loadSignedIn();
  }

  /** Changes the signed-in person's password; after a forced change, loads their data */
  async changePassword(currentPassword: string, newPassword: string) {
    await api('POST', '/api/auth/password', { currentPassword, newPassword });
    if (this.mode() === 'change_password') await this.loadSignedIn();
  }

  async logout() {
    await this.store.flushSync();
    try {
      await api('POST', '/api/auth/logout');
    } finally {
      // Drop everything from memory: a full reload starts clean
      location.assign('/login');
    }
  }

  /** Demo switcher in server mode: the server signs us in as that person */
  async switchTo(userId: string) {
    await this.store.flushSync();
    await api('POST', `/api/auth/switch/${encodeURIComponent(userId)}`);
    await this.loadSignedIn();
  }
}
