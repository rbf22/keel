import { storage } from "../storage";

export class VFSHandler {
  /**
   * Handle natural language VFS commands
   */
  async handleVFSCommand(request: string): Promise<string | null> {
    const lowerRequest = request.toLowerCase();
    
    // Save/Write commands
    if ((lowerRequest.includes('save') || lowerRequest.includes('write')) && lowerRequest.includes('keel://')) {
      const pathMatch = request.match(/(keel:\/\/\S+)/);
      if (pathMatch) {
        const path = pathMatch[1];
        const pathIndex = request.indexOf(path);
        const pathEnd = pathIndex + path.length;
        const colonIndex = request.indexOf(':', pathEnd);
        let content = '';
        
        if (colonIndex > -1) {
          content = request.substring(colonIndex + 1).trim();
        } else {
          const asIndex = lowerRequest.lastIndexOf(' as ');
          if (asIndex > -1 && asIndex < pathIndex) {
            content = request.substring(asIndex + 4, pathIndex).trim();
          } else if (lowerRequest.includes('write')) {
            const writeIndex = lowerRequest.indexOf('write');
            content = request.substring(writeIndex + 5, pathIndex).trim()
              .replace(/^this\s+to\s+/i, '')
              .replace(/^to\s+/i, '');
          }
        }
        
        if (content) {
          try {
            await storage.writeFile(path, content);
            return `Successfully saved to ${path}`;
          } catch (error) {
            return `Error saving to ${path}: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
      }
    }
    
    // Delete commands
    const deleteMatch = request.match(/delete(?:\s+the)?\s+(?:file\s+)?(keel:\/\/\S+)/i);
    if (deleteMatch) {
      const path = deleteMatch[1];
      try {
        const deleted = await storage.deleteFile(path);
        return deleted ? `Successfully deleted ${path}` : `File not found: ${path}`;
      } catch (error) {
        return `Error deleting ${path}: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
    
    // Read commands
    const readMatch = request.match(/read(?:\s+the)?\s+(?:file\s+)?(keel:\/\/\S+)/i);
    if (readMatch) {
      const path = readMatch[1];
      try {
        const content = await storage.readFile(path);
        return content === null ? `File not found: ${path}` : content;
      } catch (error) {
        return `Error reading ${path}: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
    
    // List commands
    if ((lowerRequest.includes('list') || lowerRequest.includes('vfs_ls')) && lowerRequest.includes('keel://')) {
      const pathMatch = request.match(/keel:\/\/(\S*?)(?:\s|$)/i);
      const prefix = pathMatch ? `keel://${pathMatch[1]}` : 'keel://';
      try {
        const files = await storage.listFiles(prefix);
        return files.length > 0 ? files.join('\n') : `No files found in ${prefix}`;
      } catch (error) {
        return `Error listing files in ${prefix}: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
    
    return null;
  }
}
