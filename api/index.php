<?php
require_once($_SERVER['DOCUMENT_ROOT']."/sdk-1.0.0/src/class/aim.php");
$request_path = explode('/api', $_SERVER['REQUEST_URI'])[1];
$url = "https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0{$request_path}";
$arr = explode('/',$url);
if (array_pop($arr) === 'resource') {
  $json = json_decode(file_get_contents(implode('/', $arr)),true);
  header("Content-Type: {$json['ContentType']}");
} else {
  header('Content-Type: application/json');
}
exit(file_get_contents($url));
