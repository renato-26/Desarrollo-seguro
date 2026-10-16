<?php

include("setup/setup.php");
require_once __DIR__ . '/setup/sesion_segura.php';

$sql="INSERT INTO comentarios SET usuario='".$_POST['usuario']."',comentario='".$_POST['comentario']."',id_restaurante=".$_SESSION['id'];
mysqli_query(conectar(),$sql);

header('Location:index.php?id='.$_SESSION['id'])


?>