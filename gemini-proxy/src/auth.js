import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com';
const CODE_ASSIST_API_VERSION = 'v1internal';
const OAUTH_CLIENT_ID = 'YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com';
const OAUTH_CLIENT_SECRET = 'YOUR_GOOGLE_OAUTH_CLIENT_SECRET';
const OAUTH_REFRESH_URL = 'https://oauth2.googleapis.com/token';
const TOKEN_BUFFER_TIME = 5 * 60 * 1000;
const TOKEN_CACHE_FILE = '.token_cache.json';

class AuthManager {
  constructor(env) {
    this.env = env;
    this.accessToken = null;
    this.tokenCache = this.loadTokenCache();
  }

  loadTokenCache() {
    try {
      if (fs.existsSync(TOKEN_CACHE_FILE)) {
        const data = JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, 'utf8'));
        console.log('[Auth] Loaded token cache from file');
        return data;
      }
    } catch (e) {
      console.error('[Auth] Failed to load token cache:', e.message);
    }
    return null;
  }

  saveTokenCache(tokenData) {
    try {
      fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(tokenData, null, 2));
      console.log('[Auth] Saved token cache to file');
    } catch (e) {
      console.error('[Auth] Failed to save token cache:', e.message);
    }
  }

  async initializeAuth() {
    if (!this.env.GCP_SERVICE_ACCOUNT) {
      throw new Error('GCP_SERVICE_ACCOUNT environment variable not set');
    }

    let oauth2Creds;
    try {
      oauth2Creds = JSON.parse(this.env.GCP_SERVICE_ACCOUNT);
    } catch (parseError) {
      throw new Error(`Invalid GCP_SERVICE_ACCOUNT JSON: ${parseError.message}`);
    }

    if (!oauth2Creds.refresh_token) {
      throw new Error('GCP_SERVICE_ACCOUNT is missing refresh_token');
    }

    try {
      if (this.tokenCache) {
        const timeUntilExpiry = this.tokenCache.expiry_date - Date.now();
        if (timeUntilExpiry > TOKEN_BUFFER_TIME) {
          this.accessToken = this.tokenCache.access_token;
          console.log(`[Auth] Using cached token, valid for ${Math.floor(timeUntilExpiry / 1000)}s`);
          return;
        }
        console.log('[Auth] Cached token expired or expiring soon');
      }

      const timeUntilExpiry = oauth2Creds.expiry_date - Date.now();
      if (timeUntilExpiry > TOKEN_BUFFER_TIME) {
        this.accessToken = oauth2Creds.access_token;
        console.log(`[Auth] Original token valid for ${Math.floor(timeUntilExpiry / 1000)}s`);
        this.saveTokenCache({
          access_token: oauth2Creds.access_token,
          expiry_date: oauth2Creds.expiry_date,
          cached_at: Date.now()
        });
        return;
      }

      console.log('[Auth] All tokens expired, refreshing...');
      await this.refreshAndCacheToken(oauth2Creds.refresh_token);
    } catch (e) {
      console.error('[Auth] Failed to initialize:', e.message);
      throw new Error('Authentication failed: ' + e.message);
    }
  }

  async refreshAndCacheToken(refreshToken) {
    console.log('[Auth] Refreshing OAuth token...');

    try {
      const refreshResponse = await fetch(OAUTH_REFRESH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: OAUTH_CLIENT_ID,
          client_secret: OAUTH_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        if (refreshResponse.status === 400 && errorText.includes('invalid_grant')) {
          throw new Error('Token refresh failed: refresh_token is invalid or revoked. Please re-authenticate with `gemini auth`');
        }
        throw new Error(`Token refresh failed (${refreshResponse.status}): ${errorText}`);
      }

      const refreshData = await refreshResponse.json();

      if (!refreshData.access_token) {
        throw new Error('Token refresh response missing access_token');
      }

      this.accessToken = refreshData.access_token;
      const expiryTime = Date.now() + (refreshData.expires_in || 3600) * 1000;

      console.log(`[Auth] Token refreshed, expires in ${refreshData.expires_in}s`);

      this.saveTokenCache({
        access_token: refreshData.access_token,
        expiry_date: expiryTime,
        cached_at: Date.now()
      });
    } catch (e) {
      if (e.message.includes('Token refresh failed')) throw e;
      throw new Error(`Failed to refresh token: ${e.message}`);
    }
  }

  clearTokenCache() {
    this.tokenCache = null;
    try {
      if (fs.existsSync(TOKEN_CACHE_FILE)) {
        fs.unlinkSync(TOKEN_CACHE_FILE);
        console.log('[Auth] Cleared token cache file');
      }
    } catch (e) {
      console.error('[Auth] Error clearing cache:', e.message);
    }
  }

  async callEndpoint(method, body, isRetry = false) {
    await this.initializeAuth();

    const url = `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:${method}`;
    console.log(`[Auth] Calling endpoint: ${method}`);

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
        console.log('[Auth] Got 401, clearing cache and retrying...');
        this.accessToken = null;
        this.clearTokenCache();
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
