
/**
 * [Phase 4-4] Sequential Task Queue
 * 비동기 작업들을 한 줄로 세워 순차적으로 실행함으로써 레이스 컨디션을 방지합니다.
 * 특히 DB 쓰기 작업이 포함된 서사 동기화 로직에 필수적입니다.
 */

type Task<T = any> = () => Promise<T>;

class TaskQueue {
    private queue: Promise<any> = Promise.resolve();
    private pendingCount: number = 0;

    /**
     * 작업을 큐에 추가하고 실행 순서를 보장합니다.
     */
    enqueue<T>(task: Task<T>): Promise<T> {
        this.pendingCount++;
        
        const promise = this.queue.then(async () => {
            try {
                return await task();
            } finally {
                this.pendingCount--;
            }
        });

        this.queue = promise.catch(() => {
            // 에러가 발생해도 다음 작업은 계속 진행될 수 있도록 보장
        });

        return promise;
    }

    get length(): number {
        return this.pendingCount;
    }
}

// 서사 동기화 전용 큐 인스턴스 (싱글톤)
export const narrativeSyncQueue = new TaskQueue();
