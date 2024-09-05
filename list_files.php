<?php
$directory = 'data/';
$files = glob($directory . '*.geojson');
$fileList = array_map('basename', $files);
echo json_encode($fileList);
?>
