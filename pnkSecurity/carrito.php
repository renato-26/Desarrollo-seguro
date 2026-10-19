<?php

include("setup/setup.php");
require_once __DIR__ . '/setup/sesion_segura.php';

// VUL-09: control de acceso en el servidor. Las operaciones del carrito
// solo se ejecutan para usuarios autenticados, aunque se invoque directamente.
if (!isset($_SESSION['nombre'])) {
    http_response_code(403);
    exit('Acceso no autorizado');
}

switch($_POST['op'])
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
    $_SESSION["carrito"];
    $sql="select id, nombre, precio from items where id=".$_POST['iditems'];
    $result=mysqli_query(conectar(),$sql);
    $datos=mysqli_fetch_array($result);

    $pos=count($_SESSION["carrito"])+1;
    $productos = array("posicion"=>$pos,"id" => $datos['id'], "nombre" =>$datos['nombre'],"precio"=>$datos['precio']);
    $_SESSION["carrito"][$pos] = $productos;
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