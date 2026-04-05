export class ZoomPanHelper {
    static setup(app, container, onUpdate) {
        let isPanning = false;
        let scale = 1, originX = 0, originY = 0;
        let startX, startY;

        app.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = app.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const oldScale = scale;
            const delta = e.deltaY < 0 ? 1.1 : 0.909; // Approx 1/1.1
            scale = Math.min(Math.max(0.1, scale * delta), 4);

            // Zoom into cursor point
            originX = mouseX - (mouseX - originX) * (scale / oldScale);
            originY = mouseY - (mouseY - originY) * (scale / oldScale);

            onUpdate(scale, originX, originY);
        }, { passive: false });

        app.addEventListener('mousedown', (e) => {
            if (e.button !== 0 || e.target.closest('.node-item, .pert-task-card, .tab-btn, button')) return; 
            isPanning = true; 
            startX = e.clientX - originX; 
            startY = e.clientY - originY;
            app.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
            if (isPanning) {
                originX = e.clientX - startX;
                originY = e.clientY - startY;
                onUpdate(scale, originX, originY);
            }
        });

        window.addEventListener('mouseup', () => {
            isPanning = false;
            app.style.cursor = 'grab';
        });

        return {
            getScale: () => scale,
            getOriginX: () => originX,
            getOriginY: () => originY,
            setScaleAndOrigin: (s, x, y) => { scale = s; originX = x; originY = y; }
        };
    }
}
