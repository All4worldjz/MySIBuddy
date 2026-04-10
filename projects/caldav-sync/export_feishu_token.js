#!/usr/bin/env node
/**
 * 导出飞书用户 OAuth refresh_token
 * 
 * 用途: 从 openclaw-lark 加密存储中导出 refresh_token
 * 运行: node /home/admin/.openclaw/scripts/export_feishu_token.js
 */

const { getStoredToken } = require('/home/admin/.openclaw/extensions/openclaw-lark/src/core/token-store.js');

const APP_ID = 'cli_a93c20939cf8dbef';
const USER_OPEN_ID = 'ou_04405f4e9dbe76c2cf241402bc2096b7';

async function main() {
    try {
        console.log('=== 导出飞书用户 OAuth Token ===\n');
        console.log(`App ID: ${APP_ID}`);
        console.log(`User Open ID: ${USER_OPEN_ID}\n`);
        
        const storedToken = await getStoredToken(APP_ID, USER_OPEN_ID);
        
        if (!storedToken) {
            console.error('❌ 未找到用户 token，请先完成 OAuth 授权');
            console.error('   在飞书中向 work-hub 发送: /oauth');
            process.exit(1);
        }
        
        console.log('✅ Token 导出成功!\n');
        console.log(`Access Token: ${storedToken.accessToken?.substring(0, 20)}...`);
        console.log(`Refresh Token: ${storedToken.refreshToken?.substring(0, 20)}...`);
        console.log(`Expires At: ${new Date(storedToken.expiresAt).toISOString()}`);
        
        // 保存 refresh_token 到 Python 脚本可读取的位置
        const fs = require('fs');
        const path = require('path');
        
        const tokenFile = '/home/admin/.openclaw/data/feishu_user_refresh_token.json';
        const tokenData = {
            refresh_token: storedToken.refreshToken,
            open_id: USER_OPEN_ID,
            updated_at: new Date().toISOString(),
            expires_at: new Date(storedToken.expiresAt).toISOString()
        };
        
        fs.mkdirSync(path.dirname(tokenFile), { recursive: true });
        fs.writeFileSync(tokenFile, JSON.stringify(tokenData, null, 2));
        
        console.log(`\n✅ refresh_token 已保存到: ${tokenFile}`);
        console.log('   现在可以运行: python3 /home/admin/.openclaw/scripts/caldav_sync_full.py');
        
    } catch (error) {
        console.error('❌ 导出失败:', error.message);
        process.exit(1);
    }
}

main();
