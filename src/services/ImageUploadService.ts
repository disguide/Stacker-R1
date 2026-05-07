import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

const BUCKET_NAME = 'avatars';

/**
 * ImageUploadService — Uploads profile images to Supabase Storage.
 * 
 * File path convention: {userId}/avatar.jpg | {userId}/banner.jpg
 * Uses `upsert: true` to overwrite previous images without accumulating old files.
 */
export const ImageUploadService = {
    async upload(
        localUri: string,
        userId: string,
        type: 'avatar' | 'banner'
    ): Promise<string | null> {
        try {
            // Determine file extension and MIME type
            const isPng = localUri.toLowerCase().endsWith('.png');
            const isWebp = localUri.toLowerCase().endsWith('.webp');
            const ext = isPng ? 'png' : isWebp ? 'webp' : 'jpg';
            const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
            
            const filePath = `${userId}/${type}.${ext}`;

            if (__DEV__) console.log(`[ImageUpload] Uploading ${type} to ${filePath} via ArrayBuffer...`);

            // Read the file from local storage as base64
            const base64 = await FileSystem.readAsStringAsync(localUri, { 
                encoding: 'base64'
            });
            
            // Decode base64 to ArrayBuffer (required for Supabase upload)
            const arrayBuffer = decode(base64);

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(filePath, arrayBuffer, {
                    contentType: mimeType,
                    upsert: true,
                });

            if (uploadError) {
                console.error(`[ImageUpload] Upload failed for ${type}:`, uploadError.message);
                return null;
            }

            // Get public URL
            const { data } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(filePath);

            // Append cache-buster so the new image displays immediately
            const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

            if (__DEV__) console.log(`[ImageUpload] ${type} uploaded successfully:`, publicUrl);
            return publicUrl;
        } catch (error) {
            console.error(`[ImageUpload] Unexpected error uploading ${type}:`, error);
            return null;
        }
    },

    /**
     * Check if a URI is a local file path (needs upload) vs already a remote URL.
     */
    isLocalUri(uri: string | undefined): boolean {
        if (!uri) return false;
        return uri.startsWith('file://') || uri.startsWith('/') || uri.startsWith('content://');
    },

    /**
     * Upload a local image only if it's a local URI.
     * If it's already a remote URL, returns it as-is.
     * If upload fails, returns the original local URI as fallback.
     */
    async ensureRemote(
        uri: string | undefined,
        userId: string,
        type: 'avatar' | 'banner'
    ): Promise<string | undefined> {
        if (!uri) return undefined;
        if (!this.isLocalUri(uri)) return uri; // Already a remote URL

        const publicUrl = await this.upload(uri, userId, type);
        return publicUrl || uri; // Fallback to local URI if upload fails
    },
};
