<?php

include("setup/setup.php");
require_once __DIR__ . '/setup/sesion_segura.php';

// VUL-09: control de acceso en el servidor. Solo un usuario autenticado
// puede publicar comentarios, aunque el endpoint se invoque directamente.
if (!isset($_SESSION['nombre'])) {
    http_response_code(403);
    exit('Acceso no autorizado');
}
$sql="INSERT INTO comentarios SET usuario='".$_POST['usuario']."',comentario='".$_POST['comentario']."',id_restaurante=".$_SESSION['id'];
mysqli_query(conectar(),$sql);

header('Location:index.php?id='.$_SESSION['id'])


?>