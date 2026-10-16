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

// Consulta original.
// PENDIENTE VUL-08: reemplazar por consulta preparada.
$sql = "select * from usuarios where email='".$_POST['frmusuario']."' and password='".$_POST['frmpassword']."'";

$result = mysqli_query(conectar(), $sql);
$cont_login = mysqli_num_rows($result);
$datos = mysqli_fetch_array($result);

if ($cont_login != 0)
{
    $_SESSION['nombre'] = $datos['nombre'];
}

// Regresar al restaurante seleccionado.
header('Location: ../index.php?id=' . $idRestaurante);
exit;