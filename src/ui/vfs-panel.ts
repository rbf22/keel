import { logger } from "../logger";
import { storage } from "../storage";
import { IndexedDBWrapper } from "../storage/indexeddb-wrapper";
import { VFS_PAGE_SIZE } from "../constants";

export class VFSPanel {
  private vfsContainer: HTMLElement;
  private refreshContextBtn: HTMLButtonElement;

  constructor() {
    this.vfsContainer = document.getElementById('vfsContainer')!;
    this.refreshContextBtn = document.getElementById('refreshContextBtn')! as HTMLButtonElement;

    this.init();
  }

  private init() {
    this.refreshContextBtn.onclick = () => this.refresh();
  }

  async refresh() {
    if (!storage) return;
    this.vfsContainer.textContent = 'Loading...';
    
    try {
      const storageWithDb = storage as unknown as { db?: IDBDatabase };
      
      if (!storageWithDb.db) {
        this.vfsContainer.textContent = 'Storage not initialized. Please initialize Keel first.';
        return;
      }
      
      const isHealthy = await IndexedDBWrapper.checkDatabaseHealth(storageWithDb.db);
      if (!isHealthy) {
        this.vfsContainer.textContent = 'Storage database is not accessible. Please refresh the page.';
        logger.error('vfs', 'Database health check failed');
        return;
      }
      
      const files = await storage.listFiles();
      this.vfsContainer.textContent = '';
      
      if (files.length === 0) {
        this.vfsContainer.textContent = 'No files in keel://';
        return;
      }

      const PAGE_SIZE = VFS_PAGE_SIZE;
      let currentPage = 1;
      const totalPages = Math.ceil(files.length / PAGE_SIZE);

      const paginationDiv = document.createElement('div');
      paginationDiv.className = 'vfs-pagination';
      paginationDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding: 0.5rem; border-bottom: 1px solid #333;';

      const pageInfo = document.createElement('span');
      pageInfo.style.cssText = 'color: #888; font-size: 0.9rem;';
      
      const controlsDiv = document.createElement('div');
      controlsDiv.style.cssText = 'display: flex; gap: 0.5rem;';

      const prevBtn = document.createElement('button');
      prevBtn.textContent = '← Previous';
      prevBtn.style.cssText = 'padding: 0.25rem 0.5rem; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer;';
      prevBtn.disabled = true;

      const nextBtn = document.createElement('button');
      nextBtn.textContent = 'Next →';
      nextBtn.style.cssText = 'padding: 0.25rem 0.5rem; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer;';
      if (totalPages <= 1) nextBtn.disabled = true;

      controlsDiv.appendChild(prevBtn);
      controlsDiv.appendChild(nextBtn);
      paginationDiv.appendChild(pageInfo);
      paginationDiv.appendChild(controlsDiv);
      this.vfsContainer.appendChild(paginationDiv);

      const contentDiv = document.createElement('div');
      contentDiv.className = 'vfs-content';
      this.vfsContainer.appendChild(contentDiv);

      const displayPage = async (page: number) => {
        const startIndex = (page - 1) * PAGE_SIZE;
        const endIndex = startIndex + PAGE_SIZE;
        const pageFiles = files.slice(startIndex, endIndex);
        
        contentDiv.textContent = '';
        const results = await IndexedDBWrapper.getMultipleFiles(storageWithDb.db!, pageFiles);
        
        results.forEach(({ path, file }) => {
          if (file) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'vfs-item';
            itemDiv.style.cssText = 'margin-bottom: 1rem; padding: 0.5rem; border: 1px solid #333; border-radius: 4px;';
            itemDiv.innerHTML = `
              <div class="vfs-path" style="font-weight: bold; color: #007AFF;">${file.path}</div>
              <div class="vfs-meta" style="color: #888; font-size: 0.8rem; margin-top: 0.25rem;">Type: ${file.mimeType} | Updated: ${new Date(file.updatedAt).toLocaleString()}</div>
              <div class="vfs-content" style="margin-top: 0.5rem; color: #ccc; font-size: 0.9rem;">${file.content.substring(0, 500)}${file.content.length > 500 ? '...' : ''}</div>
            `;
            contentDiv.appendChild(itemDiv);
          } else {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'vfs-item';
            errorDiv.style.cssText = 'margin-bottom: 1rem; padding: 0.5rem; border: 1px solid #ff453a; border-radius: 4px;';
            errorDiv.innerHTML = `
              <div class="vfs-path" style="font-weight: bold; color: #ff453a;">${path}</div>
              <div class="vfs-meta" style="color: #ff453a; font-size: 0.8rem; margin-top: 0.25rem;">Error: Could not load file details</div>
            `;
            contentDiv.appendChild(errorDiv);
          }
        });

        pageInfo.textContent = `Page ${page} of ${totalPages} (${files.length} files total)`;
        prevBtn.disabled = page === 1;
        nextBtn.disabled = page === totalPages;
      };

      prevBtn.onclick = () => {
        if (currentPage > 1) {
          currentPage--;
          void displayPage(currentPage);
        }
      };

      nextBtn.onclick = () => {
        if (currentPage < totalPages) {
          currentPage++;
          void displayPage(currentPage);
        }
      };

      await displayPage(1);
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('vfs', 'Failed to refresh VFS display', { error: err });
      this.vfsContainer.textContent = `Error: ${errorMessage}`;
    }
  }
}
