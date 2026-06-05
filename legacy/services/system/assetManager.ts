/**
 * [Phase 2-J] Asset Manager: Centralized ObjectURL Management
 * 브라우저 메모리 누수를 방지하기 위해 모든 Blob URL의 생성, 등록 및 자동 소각을 전담합니다.
 * [Hotfix Phase 1] Grace Period 도입: 등록 후 5초 이내의 자산은 소각을 유예합니다.
 */

class AssetManager {
    // URL과 등록 시각(timestamp)을 함께 기록하는 레지스트리
    private registry: Map<string, number> = new Map();
    private readonly GRACE_PERIOD = 5000; // 5초 유예

    /**
     * Blob 객체로부터 관리형 URL을 생성하고 레지스트리에 등록합니다.
     */
    createManagedUrl(blob: Blob): string {
        const url = URL.createObjectURL(blob);
        this.registry.set(url, Date.now());
        return url;
    }

    /**
     * 외부에서 생성된(예: DB 로드 시) URL을 관리 대상으로 등록합니다.
     */
    registerUrl(url: string) {
        if (url && url.startsWith('blob:') && !this.registry.has(url)) {
            this.registry.set(url, Date.now());
        }
    }

    /**
     * 특정 URL을 즉시 소각하고 관리 대상에서 제외합니다.
     * 주의: 중앙 제어를 위해 외부 호출은 지양하며 cleanup 로직에 위임합니다.
     */
    revokeUrl(url: string) {
        if (this.registry.has(url)) {
            URL.revokeObjectURL(url);
            this.registry.delete(url);
        }
    }

    /**
     * [Librarian Process]
     * 현재 앱 상태에서 실제로 사용 중인 URL 목록을 대조하여 소각합니다.
     * [Hotfix] 유용하지 않은 자산이라도 등록 후 5초가 지나지 않았다면 소각하지 않습니다.
     */
    cleanup(activeUrls: Set<string>) {
        const now = Date.now();
        const staleUrls: string[] = [];

        this.registry.forEach((registeredTime, url) => {
            if (!activeUrls.has(url)) {
                // 사용 중이지 않으면서 유예 기간 5초가 경과한 경우에만 소각 대상으로 분류
                if (now - registeredTime > this.GRACE_PERIOD) {
                    staleUrls.push(url);
                }
            }
        });

        staleUrls.forEach(url => {
            URL.revokeObjectURL(url);
            this.registry.delete(url);
        });

        if (staleUrls.length > 0) {
            console.debug(`[AssetManager] Gracefully purged ${staleUrls.length} stale assets after buffer.`);
        }
    }

    /**
     * 레지스트리의 현재 크기를 반환합니다.
     */
    getRegistrySize(): number {
        return this.registry.size;
    }
}

export const assetManager = new AssetManager();