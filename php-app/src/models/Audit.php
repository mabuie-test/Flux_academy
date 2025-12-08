<?php
namespace App\Models;

use App\Config\Database;

class Audit
{
    public static function record(?int $userId, string $action, array $meta): void
    {
        $stmt = Database::pdo()->prepare('INSERT INTO audits (user_id, action, meta) VALUES (:user_id, :action, :meta)');
        $stmt->execute([
            ':user_id' => $userId,
            ':action' => $action,
            ':meta' => json_encode($meta)
        ]);
    }
}
