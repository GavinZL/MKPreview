/**
 * Apple Notarization 脚本
 * 用于将构建好的 .dmg 文件提交给 Apple 进行公证
 * 
 * 使用方法:
 *   1. 设置环境变量:
 *      export APPLE_ID="your@apple.com"
 *      export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"  (App 专用密码)
 *      export APPLE_TEAM_ID="XXXXXXXXXX"
 *   
 *   2. 运行脚本:
 *      npm run tauri:notarize
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// 环境变量配置
const APPLE_ID = process.env.APPLE_ID;
const APPLE_PASSWORD = process.env.APPLE_PASSWORD;
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;

// 检查环境变量
if (!APPLE_ID || !APPLE_PASSWORD || !APPLE_TEAM_ID) {
  console.error('❌ 缺少必要的环境变量:');
  if (!APPLE_ID) console.error('   - APPLE_ID');
  if (!APPLE_PASSWORD) console.error('   - APPLE_PASSWORD (App 专用密码)');
  if (!APPLE_TEAM_ID) console.error('   - APPLE_TEAM_ID');
  console.error('\n请设置环境变量后重试:');
  console.error('  export APPLE_ID="your@apple.com"');
  console.error('  export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"');
  console.error('  export APPLE_TEAM_ID="XXXXXXXXXX"');
  process.exit(1);
}

// 查找最新的 .dmg 文件
const dmgDir = path.join(process.cwd(), 'src-tauri/target/release/bundle/dmg');
if (!fs.existsSync(dmgDir)) {
  console.error('❌ DMG 目录不存在，请先运行构建命令');
  process.exit(1);
}

const dmgFiles = fs.readdirSync(dmgDir).filter(f => f.endsWith('.dmg'));
if (dmgFiles.length === 0) {
  console.error('❌ 未找到 .dmg 文件');
  process.exit(1);
}

// 使用最新的 DMG 文件
const dmgPath = path.join(dmgDir, dmgFiles[dmgFiles.length - 1]);
const appPath = dmgPath.replace('.dmg', '.app');
const bundleId = 'com.mkpreview.app';

console.log('📦 DMG 文件:', dmgPath);
console.log('📦 APP 路径:', appPath);
console.log('');

// 步骤 1: 验证文件存在
console.log('1️⃣ 验证文件...');
if (!fs.existsSync(dmgPath)) {
  console.error('❌ DMG 文件不存在:', dmgPath);
  process.exit(1);
}
console.log('   ✅ 文件验证通过\n');

// 步骤 2: 提交 Notarization
console.log('2️⃣ 提交 Apple Notarization...');
console.log('   (这可能需要几分钟时间...)\n');

try {
  const submitCmd = [
    'xcrun', 'altool',
    '--notarize-app',
    '--file', dmgPath,
    '--primary-bundle-id', bundleId,
    '--username', APPLE_ID,
    '--password', APPLE_PASSWORD,
    '--team-id', APPLE_TEAM_ID
  ].join(' ');

  console.log('   执行命令:', submitCmd.replace(APPLE_PASSWORD, '****'));
  const submitResult = execSync(submitCmd, { encoding: 'utf-8' });
  console.log('   提交结果:', submitResult);

  // 从结果中提取 RequestUUID
  const uuidMatch = submitResult.match(/RequestUUID:\s*([a-f0-9-]+)/i);
  if (!uuidMatch) {
    console.error('❌ 无法解析 RequestUUID');
    console.log('完整输出:', submitResult);
    process.exit(1);
  }

  const requestUuid = uuidMatch[1];
  console.log('   ✅ 提交成功，RequestUUID:', requestUuid);
  console.log('');

  // 步骤 3: 等待并检查 Notarization 状态
  console.log('3️⃣ 等待 Notarization 完成...');
  console.log('   (每 30 秒检查一次状态)\n');

  let status = 'in_progress';
  let attempts = 0;
  const maxAttempts = 20;

  while (status === 'in_progress' && attempts < maxAttempts) {
    attempts++;
    console.log(`   检查 #${attempts}/${maxAttempts}...`);

    await new Promise(resolve => setTimeout(resolve, 30000));

    try {
      const statusCmd = [
        'xcrun', 'altool',
        '--notarization-info', requestUuid,
        '--username', APPLE_ID,
        '--password', APPLE_PASSWORD,
        '--team-id', APPLE_TEAM_ID
      ].join(' ');

      const statusResult = execSync(statusCmd, { encoding: 'utf-8' });
      console.log('   状态:', statusResult);

      if (statusResult.includes('Status: success')) {
        status = 'success';
      } else if (statusResult.includes('Status: invalid') || statusResult.includes('Status: fail')) {
        status = 'failed';
        console.error('❌ Notarization 失败!');
        console.log('详细错误:', statusResult);
        process.exit(1);
      }
    } catch (err) {
      // 仍在处理中
      console.log('   仍在处理中...');
    }
  }

  if (status === 'success') {
    console.log('');
    console.log('4️⃣ 验证签名...');
    
    // 步骤 4: 验证签名
    const verifyCmd = `codesign -vv "${appPath}"`;
    const verifyResult = execSync(verifyCmd, { encoding: 'utf-8' });
    console.log('   ✅ 签名验证通过');
    console.log('');

    console.log('🎉 Notarization 完成！');
    console.log('');
    console.log('下一步:');
    console.log('1. 重新压缩 DMG 文件（如果需要）');
    console.log('2. 分发给用户安装');
    console.log('');
    console.log('注意: 如果用户仍遇到"已损坏"警告，运行:');
    console.log(`  xattr -cr "${appPath}"`);
  } else {
    console.log('⚠️  Notarization 超时，请稍后手动检查状态:');
    console.log(`  xcrun altool --notarization-info ${requestUuid} --username ${APPLE_ID} --password **** --team-id ${APPLE_TEAM_ID}`);
  }

} catch (error) {
  console.error('❌ Notarization 失败:', error.message);
  process.exit(1);
}
