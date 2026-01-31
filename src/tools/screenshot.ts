/**
 * Screenshot tools for visual capture
 */

import { successResponse, errorResponse, TOKEN_LIMITS } from '../utils/response-helpers.js';
import { handleUidError } from '../utils/uid-helpers.js';
import type { McpToolResponse } from '../types/common.js';
import { writeFile } from 'fs/promises';
import { resolve } from 'path';

// Tool definitions
export const screenshotPageTool = {
  name: 'screenshot_page',
  description: 'Capture page screenshot as base64 PNG or save to file.',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Optional path to save screenshot file (PNG). If provided, saves to file instead of returning base64.',
      },
    },
  },
};

export const screenshotByUidTool = {
  name: 'screenshot_by_uid',
  description: 'Capture element screenshot by UID as base64 PNG or save to file.',
  inputSchema: {
    type: 'object',
    properties: {
      uid: {
        type: 'string',
        description: 'Element UID from snapshot',
      },
      filePath: {
        type: 'string',
        description: 'Optional path to save screenshot file (PNG). If provided, saves to file instead of returning base64.',
      },
    },
    required: ['uid'],
  },
};

/**
 * Build screenshot response with size safeguards or save to file.
 */
async function buildScreenshotResponse(
  base64Png: string,
  label: string,
  filePath?: string
): Promise<McpToolResponse> {
  const sizeKB = Math.round(base64Png.length / 1024);

  // If filePath is provided, save to file instead of returning base64
  if (filePath) {
    try {
      const absolutePath = resolve(filePath);
      const buffer = Buffer.from(base64Png, 'base64');
      await writeFile(absolutePath, buffer);
      return successResponse(`📸 ${label} (${sizeKB}KB) saved to ${absolutePath}`);
    } catch (error) {
      throw new Error(`Failed to save screenshot to ${filePath}: ${(error as Error).message}`);
    }
  }

  // Check if screenshot exceeds size limit
  if (base64Png.length > TOKEN_LIMITS.MAX_SCREENSHOT_CHARS) {
    const truncatedData = base64Png.slice(0, TOKEN_LIMITS.MAX_SCREENSHOT_CHARS);
    return successResponse(`📸 ${label} (${sizeKB}KB) [truncated]\n${truncatedData}`);
  }

  // Add warning for large screenshots
  const warn = base64Png.length > TOKEN_LIMITS.WARNING_THRESHOLD_CHARS ? ' [large]' : '';
  return successResponse(`📸 ${label} (${sizeKB}KB)${warn}\n${base64Png}`);
}

// Handlers
export async function handleScreenshotPage(args: unknown): Promise<McpToolResponse> {
  try {
    const { filePath } = (args as { filePath?: string }) || {};

    const { getFirefox } = await import('../index.js');
    const firefox = await getFirefox();

    const base64Png = await firefox.takeScreenshotPage();

    if (!base64Png || typeof base64Png !== 'string') {
      throw new Error('Invalid screenshot data');
    }

    return await buildScreenshotResponse(base64Png, 'page', filePath);
  } catch (error) {
    return errorResponse(error as Error);
  }
}

export async function handleScreenshotByUid(args: unknown): Promise<McpToolResponse> {
  try {
    const { uid, filePath } = args as { uid: string; filePath?: string };

    if (!uid || typeof uid !== 'string') {
      throw new Error('uid required');
    }

    const { getFirefox } = await import('../index.js');
    const firefox = await getFirefox();

    try {
      const base64Png = await firefox.takeScreenshotByUid(uid);

      if (!base64Png || typeof base64Png !== 'string') {
        throw new Error('Invalid screenshot data');
      }

      return await buildScreenshotResponse(base64Png, uid, filePath);
    } catch (error) {
      throw handleUidError(error as Error, uid);
    }
  } catch (error) {
    return errorResponse(error as Error);
  }
}
