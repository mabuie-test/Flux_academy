<?php
namespace App\Config;

use Dotenv\Dotenv;

class Config
{
    private static array $env;

    public static function load(string $basePath): void
    {
        $dotenv = Dotenv::createImmutable($basePath);
        $dotenv->safeLoad();
        self::$env = $_ENV + $_SERVER;
    }

    public static function get(string $key, $default = null)
    {
        return self::$env[$key] ?? $default;
    }
}
