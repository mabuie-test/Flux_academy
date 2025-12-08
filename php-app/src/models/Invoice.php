<?php
namespace App\Models;

use App\Config\Database;

class Invoice
{
    public static function create(array $data): int
    {
        $stmt = Database::pdo()->prepare('INSERT INTO invoices (order_id, user_id, numero, valor_total, detalhes, estado, vencimento, comprovativo) VALUES (:order_id, :user_id, :numero, :valor_total, :detalhes, :estado, :vencimento, :comprovativo)');
        $stmt->execute([
            ':order_id' => $data['order_id'],
            ':user_id' => $data['user_id'],
            ':numero' => $data['numero'],
            ':valor_total' => $data['valor_total'],
            ':detalhes' => json_encode($data['detalhes']),
            ':estado' => $data['estado'],
            ':vencimento' => $data['vencimento'],
            ':comprovativo' => $data['comprovativo'] ?? null,
        ]);
        return (int) Database::pdo()->lastInsertId();
    }

    public static function updateEstado(int $id, string $estado): void
    {
        $stmt = Database::pdo()->prepare('UPDATE invoices SET estado = :estado WHERE id = :id');
        $stmt->execute([':estado' => $estado, ':id' => $id]);
    }
}
