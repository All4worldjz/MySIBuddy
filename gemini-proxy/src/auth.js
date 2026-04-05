import fetch from 'node-fetch';
import fs from 'fs';

const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com';
const CODE_ASSIST_API_VERSION = 'v1internal';
const OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || 'YOUR_CLIENT_ID_HERE';
const OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || 'YOUR_CLIENT_SECRET_HERE';
const OAUTH_REFRESH_URL = 'https://oauth2.googleapis.com/token';
const TOKEN_BUFFER_TIME = 5 * 60 * 1000; // 5 分钟缓冲
const TOKEN_CACHE_FILE = '.token_cache.json';

class AuthManager {
  constructor(env) {
    this.env = env;
    this.accessToken = null;
    this.tokenExpiry = null;
    this.tokenCache = this.loadTokenCache();
  }

  loadTokenCache() {
    try {
      if (fs.existsSync(TOKEN_CACHE_FILE)) {
        const data = JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, 'utf8'));
        // 验证缓存有效性
        if (data.expiry_date && data.expiry_date > Date.now() + TOKEN_BUFFER_TIME) {
          console.log('[Auth] Loaded valid token cache');
          return data;
        }
        console.log('[Auth] Token cache expired');
      }
    } catch (e) {
      console.error('[Auth] Failed to load token cache:', e.message);
    }
    return null;
  }

  saveTokenCache(tokenData) {
    try {
      fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(tokenData, null, 2));
    } catch (e) {
      console.error('[Auth] Failed to save token cache:', e.message);
    }
  }

  async initializeAuth() {
    if (!this.env.GCP_SERVICE_ACCOUNT) {
      throw new Error('GCP_SERVICE_ACCOUNT not set');
    }

    let oauth2Creds;
    try {
      oauth2Creds = JSON.parse(this.env.GCP_SERVICE_ACCOUNT);
    } catch {
      throw new Error('Invalid GCP_SERVICE_ACCOUNT JSON');
    }

    if (!oauth2Creds.refresh_token) {
      throw new Error('Missing refresh_token');
    }

    // 检查现有 token 有效性
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > Date.now() + TOKEN_BUFFER_TIME) {
      return; // 当前 token 有效
    }

    // 检查缓存 token
    if (this.tokenCache?.access_token && this.tokenCache.expiry_date > Date.now() + TOKEN_BUFFER_TIME) {
      this.accessToken = this.tokenCache.access_token;
      this.tokenExpiry = this.tokenCache.expiry_date;
      console.log(`[Auth] Using cached token, valid for ${Math.floor((this.tokenExpiry - Date.now()) / 1000)}s`);
      return;
    }

    // 检查原始 token
    if (oauth2Creds.access_token && oauth2Creds.expiry_date > Date.now() + TOKEN_BUFFER_TIME) {
      this.accessToken = oauth2Creds.access_token;
      this.tokenExpiry = oauth2Creds.expiry_date;
      this.saveTokenCache({
        access_token: this.accessToken,
        expiry_date: this.tokenExpiry,
        cached_at: Date.now()
      });
      console.log(`[Auth] Using original token, valid for ${Math.floor((this.tokenExpiry - Date.now()) / 1000)}s`);
      return;
    }

    // 刷新 token
    await this.refreshToken(oauth2Creds.refresh_token);
  }

  async refreshToken(refreshToken) {
    console.log('[Auth] Refreshing token...');

    const response = await fetch(OAUTH_REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: OAUTH_CLIENT_ID,
        client_secret: OAUTH_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 400 && errorText.includes('invalid_grant')) {
        throw new Error('Token revoked. Run `gemini auth` again.');
      }
      throw new Error(`Token refresh failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    if (!data.access_token) {
      throw new Error('Refresh response missing access_token');
    }

    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;

    console.log(`[Auth] Token refreshed, expires in ${data.expires_in}s`);

    this.saveTokenCache({
      access_token: this.accessToken,
      expiry_date: this.tokenExpiry,
      cached_at: Date.now()
    });
  }

  clearCache() {
    this.tokenCache = null;
    this.accessToken = null;
    this.tokenExpiry = null;
    try {
      if (fs.existsSync(TOKEN_CACHE_FILE)) {
        fs.unlinkSync(TOKEN_CACHE_FILE);
      }
    } catch (e) {
      console.error('[Auth] Error clearing cache:', e.message);
    }
  }

  async callEndpoint(method, body, isRetry = false) {
    await this.initializeAuth();

    const url = `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:${method}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      if (response.status === 401 && !isRetry) {
        console.log('[Auth] Got 401, retrying with fresh token...');
        this.clearCache();
        await this.initializeAuth();
        return this.callEndpoint(method, body, true);
      }
      const errorText = await response.text();
      throw new Error(`API call failed (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  getAccessToken() {
    return this.accessToken;
  }
}

export default AuthManager;