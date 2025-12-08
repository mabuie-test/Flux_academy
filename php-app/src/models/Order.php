<?php
namespace App\Models;

use App\Config\Database;

class Order
{
    public static function create(array $data): int
    {
        $stmt = Database::pdo()->prepare('INSERT INTO orders (user_id, tipo, area, nivel, paginas, norma, complexidade, urgencia, descricao, estado, prazo_entrega, materiais_info, materiais_percentual, invoice_id) VALUES (:user_id, :tipo, :area, :nivel, :paginas, :norma, :complexidade, :urgencia, :descricao, :estado, :prazo_entrega, :materiais_info, :materiais_percentual, :invoice_id)');
        $stmt->execute([
            ':user_id' => $data['user_id'],
            ':tipo' => $data['tipo'],
            ':area' => $data['area'],
            ':nivel' => $data['nivel'],
            ':paginas' => $data['paginas'],
            ':norma' => $data['norma'],
            ':complexidade' => $data['complexidade'],
            ':urgencia' => $data['urgencia'],
            ':descricao' => $data['descricao'],
            ':estado' => $data['estado'],
            ':prazo_entrega' => $data['prazo_entrega'],
            ':materiais_info' => $data['materiais_info'] ?? null,
            ':materiais_percentual' => $data['materiais_percentual'] ?? null,
            ':invoice_id' => $data['invoice_id'] ?? null
        ]);
        return (int) Database::pdo()->lastInsertId();
    }

    public static function attachInvoice(int $orderId, int $invoiceId): void
    {
        $stmt = Database::pdo()->prepare('UPDATE orders SET invoice_id = :invoice_id WHERE id = :id');
        $stmt->execute([':invoice_id' => $invoiceId, ':id' => $orderId]);
    }
}
