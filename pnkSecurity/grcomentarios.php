<?php

include("setup/setup.php");
require_once __DIR__ . '/setup/sesion_segura.php';

// VUL-09: control de acceso en el servidor. Solo un usuario autenticado
// puede publicar comentarios, aunque el endpoint se invoque directamente.
if (!isset($_SESSION['nombre'])) {
    http_response_code(403);
    exit('Acceso no autorizado');
}

// VUL-10: validar los datos antes de usarlos.
$idRestaurante = filter_var($_SESSION['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if ($idRestaurante === false || $idRestaurante === null) {
    http_response_code(400);
    exit('Restaurante no valido');
}

// El autor se toma de la sesion autenticada, no del campo "usuario" del formulario.
$usuario    = (string) $_SESSION['nombre'];
$comentario = trim((string) ($_POST['comentario'] ?? ''));

if ($comentario === '' || mb_strlen($comentario, 'UTF-8') > 1000) {
    http_response_code(400);
    exit('Comentario no valido');
}

// VUL-10: consulta preparada. Los valores viajan como parametros y no alteran el SQL.
$con  = conectar();
$stmt = mysqli_prepare($con, 'INSERT INTO comentarios (usuario, comentario, id_restaurante) VALUES (?, ?, ?)');
mysqli_stmt_bind_param($stmt, 'ssi', $usuario, $comentario, $idRestaurante);
mysqli_stmt_execute($stmt);
mysqli_stmt_close($stmt);

header('Location: index.php?id=' . $idRestaurante);
exit;