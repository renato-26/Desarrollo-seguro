# EVA 3 React + administración Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Carta React fiel al original y administración CRUD con permisos reales.

**Architecture:** React/Vite servido por Express, API MVC existente ampliada y migraciones incrementales PostgreSQL. Autenticación y CSRF compartidos por carta y panel.

**Tech Stack:** Node.js 24, Express 5, PostgreSQL 17, React, Vite, Bootstrap existente, Docker y Playwright.

**Spec:** docs/superpowers/specs/2026-11-16-react-admin-design.md

## Global Constraints

- Trabajar únicamente en feature/fullstack-mvc desde 6d6341c.
- No push, AWS, infraestructura de pago, DROP, TRUNCATE, borrado de volúmenes ni pruebas de escritura en DEV.
- No cambiar migraciones históricas, secretos ni archivos PHP históricos.
- No elevar automáticamente usuarios existentes.
- Mantener puertos 3101/3201/3301 y scripts/stack.mjs.

## Review Focus

- Cambios de relación que intenten mover productos o categorías a restaurantes ajenos.
- Usuarios desactivados o permisos revocados con sesiones ya iniciadas.
- Imágenes con rutas transversales, SVG, URLs remotas o archivos inexistentes.
- Datos históricos nulos y restaurantes sin productos.
- Precio cero, enteros fuera de rango y entradas desconocidas en PATCH.

## Task 1: API administrativa segura

- [x] Escribir y ejecutar pruebas de acceso sin sesión, roles, CSRF, validación y relaciones.
- [x] Añadir migración 004, modelos, servicio de validación/autorización, controlador y rutas administrativas.
- [x] Ampliar usuario público con rol/asignaciones; consultar permisos vigentes por sesión.
- [x] Implementar GET/POST/PATCH sin borrado físico y dashboard filtrado.
- [x] Añadir bootstrap administrativo explícito, con contraseña por stdin, sin tocar cuentas existentes.
- [x] Ejecutar npm.cmd test y pruebas específicas. Expected: todas aprobadas.

## Task 2: Carta y panel React

- [x] Añadir pruebas Playwright que fallen con la interfaz anterior: renderizado React y CRUD integral.
- [x] Configurar Vite y entrypoint React conservando frontend/public como recursos históricos.
- [x] Componentes de carta, encabezado, restaurante, destacados, categorías/productos, carrito, comentarios, login y estados.
- [x] Panel con navegación, dashboard y formularios CRUD para las cinco colecciones.
- [x] Validación, errores, carga, confirmación de desactivación y rutas protegidas.
- [x] Compilar con npm.cmd run build. Expected: compilación sin errores.

## Task 3: Integración, Docker, QA y documentación

- [x] Servir frontend/dist desde Express con CSP y archivos internos protegidos.
- [x] Docker multi-stage; build en pruebas/CI; mantener comandos stack existentes.
- [x] Adaptar integración para comprobar datos originales y permitir datos QA adicionales.
- [x] Ejecutar stack test qa, flujo CRUD completo y pruebas de seguridad.
- [x] Verificar salud/URLs locales y revisar cambios con revisor independiente.
- [x] Documentar endpoints, migraciones, componentes, pruebas, limitaciones y preparación AWS.

## Registro de ejecución

- Inspección: rama correcta, Git limpio, HEAD 6d6341c; Docker DEV y QA saludables; QA con migraciones 001-003 y seeds 001-002; 27 unitarias ejecutadas/aprobadas antes de cambios.
- Decisión: usar el checkout actual por petición explícita de trabajar directamente en feature/fullstack-mvc; no crear otra rama/worktree.
- Decisión: asociación de imágenes raster existentes; no almacenamiento de uploads nuevo.
- Decisión: implementar sin commits automáticos; dejar todos los cambios disponibles para revisión local.
- Task 1: completada; 17 pruebas administrativas nuevas, ampliación de usuario público y migración 004. Ver docs/admin-backend-report.md.
- Task 2: completada; React compilado, carta/panel e integración HTTP verificados en Chromium con datos QA reales.
- Task 3: código, build Docker, revisión y documentación completados; suite 47 unitarias + 2 integración + 8 Playwright aprobada. Activación en los servicios existentes no ejecutada por rechazo de autorización.
- Final: corregidos P2 de PATCH histórico y observaciones públicas mediante regresiones RED→GREEN. Límites UI/password unificados y estilos de pestañas originales conservados.
- Final: minor (deferred): clonación de dirección en cualquier PATCH de restaurante; puede acumular direcciones sin referencia, no modifica direcciones compartidas ni impide CRUD.
- Final: Ruling: mantener servicios Docker actuales tras el rechazo explícito de la actualización/reinicio; no intentar otra vía. Coste: carta React y /admin todavía no están activos en 3101/3201.
