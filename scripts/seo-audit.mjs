#!/usr/bin/env node
/**
 * SEO Audit Script
 * Checks all HTML files for proper SEO meta tags and reports issues
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '../dist');

const MAX_TITLE_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 160;

// Get all HTML files recursively
function getAllHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllHtmlFiles(filePath, fileList);
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Extract SEO metadata from HTML
function extractSeoMetadata(htmlContent) {
  const dom = new JSDOM(htmlContent);
  const doc = dom.window.document;
  
  const title = doc.querySelector('title')?.textContent?.trim() || null;
  const description = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || null;
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim() || null;
  const jsonLd = doc.querySelector('script[type="application/ld+json"]')?.textContent || null;
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() || null;
  const ogDescription = doc.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim() || null;
  
  return {
    title,
    description,
    canonical,
    hasJsonLd: !!jsonLd,
    ogTitle,
    ogDescription
  };
}

// Main audit function
function auditSeo() {
  console.log('🔍 Starting SEO audit...\n');
  
  if (!fs.existsSync(DIST_DIR)) {
    console.error('❌ Error: dist/ directory not found. Run `npm run build` first.');
    process.exit(1);
  }
  
  const htmlFiles = getAllHtmlFiles(DIST_DIR);
  console.log(`📄 Found ${htmlFiles.length} HTML files\n`);
  
  const issues = {
    missingTitle: [],
    missingDescription: [],
    missingCanonical: [],
    missingJsonLd: [],
    missingOgTitle: [],
    longTitle: [],
    longDescription: [],
    duplicateTitles: {},
    duplicateDescriptions: {}
  };
  
  const metadata = [];
  
  htmlFiles.forEach(filePath => {
    const htmlContent = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(DIST_DIR, filePath);
    const meta = extractSeoMetadata(htmlContent);
    
    metadata.push({ path: relativePath, ...meta });
    
    // Check for missing elements
    if (!meta.title) {
      issues.missingTitle.push(relativePath);
    }
    if (!meta.description) {
      issues.missingDescription.push(relativePath);
    }
    if (!meta.canonical) {
      issues.missingCanonical.push(relativePath);
    }
    if (!meta.hasJsonLd) {
      issues.missingJsonLd.push(relativePath);
    }
    if (!meta.ogTitle) {
      issues.missingOgTitle.push(relativePath);
    }
    
    // Check for length issues
    if (meta.title && meta.title.length > MAX_TITLE_LENGTH) {
      issues.longTitle.push({
        path: relativePath,
        title: meta.title,
        length: meta.title.length
      });
    }
    if (meta.description && meta.description.length > MAX_DESCRIPTION_LENGTH) {
      issues.longDescription.push({
        path: relativePath,
        description: meta.description,
        length: meta.description.length
      });
    }
    
    // Track for duplicate detection
    if (meta.title) {
      if (!issues.duplicateTitles[meta.title]) {
        issues.duplicateTitles[meta.title] = [];
      }
      issues.duplicateTitles[meta.title].push(relativePath);
    }
    if (meta.description) {
      if (!issues.duplicateDescriptions[meta.description]) {
        issues.duplicateDescriptions[meta.description] = [];
      }
      issues.duplicateDescriptions[meta.description].push(relativePath);
    }
  });
  
  // Filter out non-duplicate titles and descriptions
  Object.keys(issues.duplicateTitles).forEach(title => {
    if (issues.duplicateTitles[title].length === 1) {
      delete issues.duplicateTitles[title];
    }
  });
  Object.keys(issues.duplicateDescriptions).forEach(desc => {
    if (issues.duplicateDescriptions[desc].length === 1) {
      delete issues.duplicateDescriptions[desc];
    }
  });
  
  // Report results
  let hasIssues = false;
  
  if (issues.missingTitle.length > 0) {
    hasIssues = true;
    console.log(`❌ Missing <title> (${issues.missingTitle.length}):`);
    issues.missingTitle.forEach(p => console.log(`  - ${p}`));
    console.log();
  }
  
  if (issues.missingDescription.length > 0) {
    hasIssues = true;
    console.log(`❌ Missing meta description (${issues.missingDescription.length}):`);
    issues.missingDescription.forEach(p => console.log(`  - ${p}`));
    console.log();
  }
  
  if (issues.missingCanonical.length > 0) {
    hasIssues = true;
    console.log(`❌ Missing canonical link (${issues.missingCanonical.length}):`);
    issues.missingCanonical.forEach(p => console.log(`  - ${p}`));
    console.log();
  }
  
  if (issues.missingJsonLd.length > 0) {
    hasIssues = true;
    console.log(`⚠️  Missing JSON-LD schema (${issues.missingJsonLd.length}):`);
    issues.missingJsonLd.forEach(p => console.log(`  - ${p}`));
    console.log();
  }
  
  if (issues.missingOgTitle.length > 0) {
    hasIssues = true;
    console.log(`⚠️  Missing og:title (${issues.missingOgTitle.length}):`);
    issues.missingOgTitle.forEach(p => console.log(`  - ${p}`));
    console.log();
  }
  
  if (issues.longTitle.length > 0) {
    hasIssues = true;
    console.log(`⚠️  Title too long (>${MAX_TITLE_LENGTH} chars, ${issues.longTitle.length}):`);
    issues.longTitle.forEach(({ path, title, length }) => {
      console.log(`  - ${path} (${length} chars)`);
      console.log(`    "${title}"`);
    });
    console.log();
  }
  
  if (issues.longDescription.length > 0) {
    hasIssues = true;
    console.log(`⚠️  Description too long (>${MAX_DESCRIPTION_LENGTH} chars, ${issues.longDescription.length}):`);
    issues.longDescription.forEach(({ path, description, length }) => {
      console.log(`  - ${path} (${length} chars)`);
      console.log(`    "${description.substring(0, 80)}..."`);
    });
    console.log();
  }
  
  if (Object.keys(issues.duplicateTitles).length > 0) {
    hasIssues = true;
    console.log(`❌ Duplicate titles (${Object.keys(issues.duplicateTitles).length}):`);
    Object.entries(issues.duplicateTitles).forEach(([title, paths]) => {
      console.log(`  "${title}"`);
      paths.forEach(p => console.log(`    - ${p}`));
    });
    console.log();
  }
  
  if (Object.keys(issues.duplicateDescriptions).length > 0) {
    hasIssues = true;
    console.log(`❌ Duplicate descriptions (${Object.keys(issues.duplicateDescriptions).length}):`);
    Object.entries(issues.duplicateDescriptions).forEach(([desc, paths]) => {
      console.log(`  "${desc.substring(0, 60)}..."`);
      paths.forEach(p => console.log(`    - ${p}`));
    });
    console.log();
  }
  
  if (!hasIssues) {
    console.log('🎉 No SEO issues found! All pages have proper meta tags.\n');
    return true;
  }
  
  return false;
}

// Run the audit
const success = auditSeo();
process.exit(success ? 0 : 1);
