<?php

include("setup/setup.php");
require_once __DIR__ . '/setup/sesion_segura.php';

// VUL-09: control de acceso en el servidor. Las operaciones del carrito
// solo se ejecutan para usuarios autenticados, aunque se invoque directamente.
if (!isset($_SESSION['nombre'])) {
    http_response_code(403);
    exit('Acceso no autorizado');
}

switch($_POST['op'] ?? '')
{
    case "1": insertar();
        break;
    case "2": eliminaritems();
        break;
    case "3": eliminartodo();
        break;
}

function insertar()
{
    // VUL-10: el identificador debe ser un entero positivo; cualquier otro valor se rechaza.
    $id = filter_var($_POST['iditems'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($id === false || $id === null) {
        http_response_code(400);
        exit('Producto no valido');
    }

    // VUL-10: consulta preparada. El id viaja como parametro y nombre/precio
    // se obtienen desde la base de datos, nunca desde valores del navegador.
    $con  = conectar();
    $stmt = mysqli_prepare($con, 'SELECT id, nombre, precio FROM items WHERE id = ? LIMIT 1');
    mysqli_stmt_bind_param($stmt, 'i', $id);
    mysqli_stmt_execute($stmt);
    $datos = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));
    mysqli_stmt_close($stmt);

    if (!$datos) {
        http_response_code(404);
        exit('Producto no encontrado');
    }

    if (!isset($_SESSION['carrito']) || !is_array($_SESSION['carrito'])) {
        $_SESSION['carrito'] = [];
    }

    $pos = count($_SESSION['carrito']) + 1;
    $productos = array("posicion" => $pos, "id" => $datos['id'], "nombre" => $datos['nombre'], "precio" => $datos['precio']);
    $_SESSION['carrito'][$pos] = $productos;
}

function eliminaritems()
{
    unset($_SESSION["carrito"][$_POST['pos']]);
}

function eliminartodo()
{
    // VUL-09: vaciar solo el carrito; antes session_destroy() cerraba también la sesión del usuario.
    $_SESSION['carrito'] = [];
}
?>