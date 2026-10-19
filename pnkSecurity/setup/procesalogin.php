<?php

require_once __DIR__ . '/sesion_segura.php';
include("setup.php");

// Recuperar el restaurante seleccionado.
// Si no existe una selección previa, utilizar el restaurante 1.
$idRestaurante = $_SESSION['id'] ?? 1;

$idRestaurante = filter_var(
    $idRestaurante,
    FILTER_VALIDATE_INT,
    ['options' => ['min_range' => 1]]
);

if ($idRestaurante === false) {
    $idRestaurante = 1;
}

// VUL-08: consulta preparada. Los datos del formulario se envían como
// parámetros y nunca se concatenan al SQL, por lo que no alteran la consulta.
$email    = trim((string) ($_POST['frmusuario'] ?? ''));
$password = (string) ($_POST['frmpassword'] ?? '');

$datos = null;

if ($email !== '' && $password !== '') {
    $con  = conectar();
    $stmt = mysqli_prepare($con, 'SELECT nombre, password FROM usuarios WHERE email = ? LIMIT 1');
    mysqli_stmt_bind_param($stmt, 's', $email);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);
    $datos  = mysqli_fetch_assoc($result);
    mysqli_stmt_close($stmt);
}

// VUL-07: la contraseña se verifica contra el hash almacenado con password_hash().
// password_verify() compara de forma segura; la contraseña nunca se guarda en texto plano.
if ($datos && password_verify($password, (string) $datos['password'])) {
    $_SESSION['nombre'] = $datos['nombre'];
}

// Regresar al restaurante seleccionado.
header('Location: ../index.php?id=' . $idRestaurante);
exit;