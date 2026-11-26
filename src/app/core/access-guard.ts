import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { type NavAccess, hasAccess, homeFor } from '../layout/nav';
import { DataStore } from './data-store';

/** Sends people to their home page when their role may not open a screen (UI-only until Phase B) */
export function accessGuard(access: NavAccess): CanActivateFn {
  return () => {
    const role = inject(DataStore).currentUser().role;
    return hasAccess(role, access) || inject(Router).parseUrl(homeFor(role));
  };
}
