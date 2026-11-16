-- Correccion reproducible de fotos para la carta original de pnkSecurity.
-- No editar 001_original_data.sql: ya fue aplicada y su checksum esta registrado.
-- La imagen de crema de espinacas es ilustrativa y se incluye en frontend/public.

UPDATE items
   SET foto = 'crema_espinacas.jpg'
 WHERE id = 2 AND nombre = 'Crema de espinacas' AND foto = 'item2.jpg';

UPDATE items
   SET foto = 'item5.jpg'
 WHERE id = 7 AND nombre = 'Lomo a lo Pobre' AND foto = 'item3.jpg';
