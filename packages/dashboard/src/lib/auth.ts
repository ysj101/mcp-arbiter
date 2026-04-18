export type AuthMode = 'local' | 'cloud';

export interface DashboardUser {
  id: string;
  displayName: string;
  role: string;
}

export interface AuthAdapter {
  getCurrentUser(): DashboardUser | null;
  signIn(): void;
}

const dummyUser: DashboardUser = {
  id: 'user-local',
  displayName: 'ローカル審理官',
  role: 'arbiter-operator',
};

export const localAuthAdapter: AuthAdapter = {
  getCurrentUser: () => dummyUser,
  signIn: () => {
    // local mode は即サインイン扱い
  },
};

export const cloudAuthAdapter: AuthAdapter = {
  getCurrentUser: () => {
    if (typeof window === 'undefined') return null;
    return dummyUser;
  },
  signIn: () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/.auth/login/aad?post_login_redirect_uri=/';
    }
  },
};

export const resolveAuthAdapter = (): AuthAdapter => {
  const mode = (process.env.NEXT_PUBLIC_ARBITER_MODE as AuthMode | undefined) ?? 'local';
  return mode === 'cloud' ? cloudAuthAdapter : localAuthAdapter;
};
