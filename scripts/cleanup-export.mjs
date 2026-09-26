// scripts/cleanup-export.mjs
import { readdirSync, statSync, unlinkSync, rmdirSync, lstatSync, existsSync } from 'node:fs';
import { join, extname, resolve, relative } from 'node:path';

const OUT_DIR = 'out';

// Directories to explicitly delete
const DIRS_TO_DELETE = ['404', '_not-found'];

// Files to always delete (case-insensitive, anywhere in OUT_DIR)
const FILES_TO_DELETE = [
  '_buildmanifest.js',
  '_clientmiddlewaremanifest.js',
  '_ssgmanifest.js',
  '404.html',
];

// Verbose mode via environment variable or --verbose flag
const VERBOSE = process.env.VERBOSE === '1' || process.argv.includes('--verbose');

// Calculate absolute base path once (for Windows compatibility)
const ABSOLUTE_OUT_DIR = resolve(OUT_DIR);

/**
 * Prints a message if VERBOSE is enabled
 */
function logVerbose(...args) {
  if (VERBOSE) {
    console.log(...args);
  }
}

/**
 * Checks if a path is within OUT_DIR and is safe
 * (not a symbolic link, regular file or directory)
 */
function isSafePath(targetPath) {
  const resolvedTarget = resolve(targetPath);
  
  // Ensure the path is within OUT_DIR
  // relative() returns ".." if outside
  const relPath = relative(ABSOLUTE_OUT_DIR, resolvedTarget);
  if (relPath.startsWith('..') || resolve(relPath) === resolvedTarget) {
    return false;
  }
  
  // Ensure it's not a symbolic link
  try {
    const stats = lstatSync(targetPath);
    return stats.isFile() || stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Recursively deletes a directory with logging
 */
function deleteDirRecursive(dirPath, relativePath) {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      const relativeEntryPath = join(relativePath, entry.name);
      
      if (!isSafePath(fullPath)) {
        logVerbose(`  ⚠️  Skipping (unsafe): ${relativeEntryPath}`);
        continue;
      }
      
      if (entry.isDirectory()) {
        deleteDirRecursive(fullPath, relativeEntryPath);
      } else if (entry.isFile()) {
        try {
          unlinkSync(fullPath);
          logVerbose(`  🗑️  Deleted file: ${relativeEntryPath}`);
        } catch (error) {
          logVerbose(`  ❌ Failed to delete file: ${relativeEntryPath} (${error.message})`);
        }
      }
    }
    
    rmdirSync(dirPath);
    logVerbose(`  🗑️  Deleted directory: ${relativePath}/`);
  } catch (error) {
    logVerbose(`  ❌ Failed to delete directory: ${relativePath}/ (${error.message})`);
  }
}

/**
 * Recursively deletes build manifests (.json, .txt, FILES_TO_DELETE)
 * as well as empty directories and special directories (404, _not-found)
 * in the static Next.js export directory.
 * Keeps required assets in _next/static/ but deletes manifest files and empty folders.
 * Skips symbolic links for safety.
 */
function cleanupDir(dir, isNextStatic = false) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    logVerbose(`  ⚠️  Cannot read directory: ${dir} (${error.message})`);
    return;
  }
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    // Calculate relative path for logging
    const relativePath = dir === ABSOLUTE_OUT_DIR 
      ? entry.name 
      : relative(ABSOLUTE_OUT_DIR, dir) + '/' + entry.name;
    
    // Safety check: within OUT_DIR and not a symbolic link
    if (!isSafePath(fullPath)) {
      logVerbose(`  ⚠️  Skipping (unsafe path): ${relativePath}`);
      continue;
    }
    
    if (entry.isDirectory()) {
      // Handle _next directory specially
      if (entry.name === '_next') {
        logVerbose(`  🔍 Entering _next/ to clean manifests and empty dirs...`);
        // Enter _next but only process static subdirectories
        const nextStaticPath = join(fullPath, 'static');
        if (existsSync(nextStaticPath)) {
          cleanupDir(nextStaticPath, true);
        }
        // Clean up empty directories in _next after processing
        cleanupEmptyDirsInNext(fullPath);
        continue;
      }
      
      // Directories to explicitly delete
      if (DIRS_TO_DELETE.includes(entry.name)) {
        logVerbose(`  🎯 Target directory: ${entry.name}/`);
        deleteDirRecursive(fullPath, relativePath);
        continue;
      }
      
      cleanupDir(fullPath, isNextStatic);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      const name = entry.name.toLowerCase();
      
      let shouldDelete = false;
      let reason = '';
      
      // Delete .json and .txt files
      if (ext === '.json' || ext === '.txt') {
        shouldDelete = true;
        reason = ext === '.json' ? '.json file' : '.txt file';
      }
      // Delete specific files anywhere in OUT_DIR
      else if (FILES_TO_DELETE.some(pattern => name === pattern)) {
        shouldDelete = true;
        reason = 'forced delete file';
      }
      
      if (shouldDelete) {
        try {
          unlinkSync(fullPath);
          logVerbose(`  ✅ Deleted ${reason}: ${relativePath}`);
        } catch (error) {
          logVerbose(`  ❌ Failed to delete ${reason}: ${relativePath} (${error.message})`);
        }
      } else {
        logVerbose(`  ⏭️  Kept file: ${relativePath}`);
      }
    }
  }
  
  // Delete empty directories (except OUT_DIR itself)
  if (dir !== ABSOLUTE_OUT_DIR) {
    const remainingEntries = readdirSync(dir, { withFileTypes: true });
    
    if (remainingEntries.length === 0) {
      try {
        rmdirSync(dir);
        logVerbose(`  🗑️  Deleted empty directory: ${relative(ABSOLUTE_OUT_DIR, dir)}/`);
      } catch (error) {
        logVerbose(`  ⚠️  Cannot delete empty directory: ${relative(ABSOLUTE_OUT_DIR, dir)}/ (${error.message})`);
      }
    } else {
      logVerbose(`  ⏭️  Directory not empty: ${relative(ABSOLUTE_OUT_DIR, dir)}/ (${remainingEntries.length} items)`);
    }
  }
}

/**
 * Cleans up empty directories within _next after manifest deletion
 */
function cleanupEmptyDirsInNext(nextDir) {
  try {
    const entries = readdirSync(nextDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(nextDir, entry.name);
      
      if (!isSafePath(fullPath)) {
        continue;
      }
      
      if (entry.isDirectory() && entry.name !== 'static') {
        cleanupEmptyDirsInNext(fullPath);
        
        // Check if directory is now empty
        const remaining = readdirSync(fullPath, { withFileTypes: true });
        if (remaining.length === 0) {
          try {
            rmdirSync(fullPath);
            logVerbose(`  🗑️  Deleted empty directory in _next: ${entry.name}/`);
          } catch {
            // Ignore if not empty or in use
          }
        }
      }
    }
  } catch {
    // Ignore errors
  }
}

// Main program
try {
  // Check if OUT_DIR exists
  if (!existsSync(ABSOLUTE_OUT_DIR)) {
    console.error(`❌ Error: Output directory "${ABSOLUTE_OUT_DIR}" does not exist.`);
    console.error(`   Run "npm run build" first to create the static export.`);
    process.exit(1);
  }
  
  // Check if OUT_DIR is a directory
  const outDirStats = lstatSync(ABSOLUTE_OUT_DIR);
  if (!outDirStats.isDirectory()) {
    console.error(`❌ Error: "${ABSOLUTE_OUT_DIR}" is not a directory.`);
    process.exit(1);
  }
  
  // Check if OUT_DIR is a symbolic link
  if (outDirStats.isSymbolicLink()) {
    console.error(`❌ Error: "${ABSOLUTE_OUT_DIR}" is a symbolic link. Aborting for safety.`);
    process.exit(1);
  }
  
  console.log(`Cleaning up static export in "${ABSOLUTE_OUT_DIR}"...`);
  if (VERBOSE) {
    console.log('Verbose mode: ON\n');
  }
  
  cleanupDir(ABSOLUTE_OUT_DIR);
  
  console.log('\n✓ Cleaned up.');
} catch (error) {
  console.error('❌ Cleanup failed:', error.message);
  process.exit(1);
}