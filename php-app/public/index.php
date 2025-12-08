<?php
require __DIR__ . '/../vendor/autoload.php';

use App\Config\Config;
use App\Config\Database;

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

Config::load(dirname(__DIR__));
Database::pdo();

require __DIR__ . '/../src/routes/api.php';
