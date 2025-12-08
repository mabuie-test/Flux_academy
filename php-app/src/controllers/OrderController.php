<?php
namespace App\Controllers;

use App\Helpers\Auth;
use App\Helpers\Pricing;
use App\Helpers\Response;
use App\Helpers\AuditHelper;
use App\Helpers\Mailer;
use App\Models\Order;
use App\Models\Invoice;

class OrderController
{
    public static function quote(): void
    {
        Auth::requireUser();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        if (!isset($body['paginas'], $body['nivel'], $body['complexidade'], $body['urgencia'])) {
            Response::json(['message' => 'Dados incompletos'], 400);
            return;
        }
        $quote = Pricing::quote((int)$body['paginas'], $body['nivel'], $body['complexidade'], $body['urgencia']);
        Response::json($quote);
    }

    public static function create(): void
    {
        $user = Auth::requireUser();
        $data = $_POST;
        $quote = Pricing::quote((int)$data['paginas'], $data['nivel'], $data['complexidade'], $data['urgencia']);

        $orderId = Order::create([
            'user_id' => $user['id'],
            'tipo' => $data['tipo'],
            'area' => $data['area'],
            'nivel' => $data['nivel'],
            'paginas' => (int)$data['paginas'],
            'norma' => $data['norma'],
            'complexidade' => $data['complexidade'],
            'urgencia' => $data['urgencia'],
            'descricao' => $data['descricao'] ?? '',
            'estado' => 'PENDENTE_PAGAMENTO',
            'prazo_entrega' => $data['prazo_entrega'] ?? null,
            'materiais_info' => $data['materiais_info'] ?? null,
            'materiais_percentual' => $data['materiais_percentual'] ?? null,
        ]);

        $invoiceNumber = 'FAT-' . str_pad((string)$orderId, 6, '0', STR_PAD_LEFT);
        $invoiceId = Invoice::create([
            'order_id' => $orderId,
            'user_id' => $user['id'],
            'numero' => $invoiceNumber,
            'valor_total' => $quote['total'],
            'detalhes' => $quote,
            'estado' => 'EMITIDA',
            'vencimento' => date('Y-m-d H:i:s', strtotime('+24 hours')),
        ]);
        Order::attachInvoice($orderId, $invoiceId);
        AuditHelper::log($user['id'], 'order:create', ['order_id' => $orderId]);
        Mailer::send($user['email'], 'Fatura emitida', 'A sua fatura ' . $invoiceNumber . ' foi emitida com valor ' . $quote['total']);
        Response::json([
            'order_id' => $orderId,
            'invoice_id' => $invoiceId,
            'invoice_number' => $invoiceNumber,
            'valor_total' => $quote['total'],
        ], 201);
    }

    public static function index(): void
    {
        $user = Auth::requireUser();
        $orders = Order::listForUser($user['id']);
        Response::json(['orders' => $orders]);
    }

    public static function show(int $orderId): void
    {
        $user = Auth::requireUser();
        $order = Order::findWithInvoice($orderId);
        if (!$order) {
            Response::json(['message' => 'Encomenda não encontrada'], 404);
            return;
        }
        if ($order['user_id'] !== $user['id'] && $user['role'] !== 'admin') {
            Response::json(['message' => 'Acesso negado'], 403);
            return;
        }
        Response::json(['order' => $order]);
    }
}
