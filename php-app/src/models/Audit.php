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

    public static function listRecent(int $limit = 25): array
    {
        $stmt = Database::pdo()->prepare('SELECT a.*, u.email FROM audits a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT :lim');
        $stmt->bindValue(':lim', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }
}
