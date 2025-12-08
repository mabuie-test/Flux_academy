<?php
namespace App\Controllers;

use App\Helpers\Auth;
use App\Helpers\Pricing;
use App\Helpers\Response;
use App\Helpers\AuditHelper;
use App\Helpers\Mailer;
use App\Models\Order;
use App\Models\Invoice;
use App\Models\Feedback;
use App\Models\AffiliateCommission;
use App\Models\AffiliatePayout;
use App\Config\Config;

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
        $quote = Pricing::quote((int) $body['paginas'], $body['nivel'], $body['complexidade'], $body['urgencia']);
        Response::json($quote);
    }

    public static function create(): void
    {
        $user = Auth::requireUser();
        $data = $_POST;
        $quote = Pricing::quote((int) $data['paginas'], $data['nivel'], $data['complexidade'], $data['urgencia']);

        $materialsFiles = [];
        if (!empty($_FILES['materiais_uploads']['name'][0])) {
            $uploadDir = dirname(__DIR__, 2) . '/uploads/materiais';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0775, true);
            }
            foreach ($_FILES['materiais_uploads']['name'] as $index => $name) {
                $tmp = $_FILES['materiais_uploads']['tmp_name'][$index];
                $safeName = uniqid('mat_') . '-' . preg_replace('/[^a-zA-Z0-9\.\-_]/', '_', $name);
                $dest = $uploadDir . '/' . $safeName;
                if (move_uploaded_file($tmp, $dest)) {
                    $materialsFiles[] = '/uploads/materiais/' . $safeName;
                }
            }
        }

        $orderId = Order::create([
            'user_id' => $user['id'],
            'tipo' => $data['tipo'],
            'area' => $data['area'],
            'nivel' => $data['nivel'],
            'paginas' => (int) $data['paginas'],
            'norma' => $data['norma'],
            'complexidade' => $data['complexidade'],
            'urgencia' => $data['urgencia'],
            'descricao' => $data['descricao'] ?? '',
            'estado' => 'PENDENTE_PAGAMENTO',
            'prazo_entrega' => $data['prazo_entrega'] ?? null,
            'referred_by_code' => $data['referral_code'] ?? ($user['referred_by'] ?? null),
            'materiais_info' => $data['materiais_info'] ?? null,
            'materiais_percentual' => $data['materiais_percentual'] ?? null,
            'materiais_uploads' => $materialsFiles ? json_encode($materialsFiles) : null,
        ]);

        $invoiceNumber = 'FAT-' . str_pad((string) $orderId, 6, '0', STR_PAD_LEFT);
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
        $adminEmail = Config::get('ADMIN_NOTIFY_EMAIL');
        if ($adminEmail) {
            Mailer::send($adminEmail, 'Nova encomenda criada', 'Pedido #' . $orderId . ' criado para ' . $user['email']);
        }
        Response::json([
            'order_id' => $orderId,
            'invoice_id' => $invoiceId,
            'invoice_number' => $invoiceNumber,
            'valor_total' => $quote['total'],
        ], 201);
    }

    public static function uploadProof(): void
    {
        $user = Auth::requireUser();
        $invoiceId = (int) ($_POST['invoice_id'] ?? 0);
        if (!$invoiceId || empty($_FILES['comprovativo']['tmp_name'])) {
            Response::json(['message' => 'Comprovativo em falta'], 400);
            return;
        }
        $dir = dirname(__DIR__, 2) . '/uploads/comprovativos';
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $safeName = uniqid('comp_') . '-' . preg_replace('/[^a-zA-Z0-9\.\-_]/', '_', $_FILES['comprovativo']['name']);
        $dest = $dir . '/' . $safeName;
        if (!move_uploaded_file($_FILES['comprovativo']['tmp_name'], $dest)) {
            Response::json(['message' => 'Falha ao guardar comprovativo'], 500);
            return;
        }
        Invoice::saveComprovativo($invoiceId, '/uploads/comprovativos/' . $safeName);
        Order::updateEstado((int) ($_POST['order_id'] ?? 0), 'PAGAMENTO_EM_VALIDACAO');
        AuditHelper::log($user['id'], 'invoice:proof', ['invoice_id' => $invoiceId]);
        $adminEmail = Config::get('ADMIN_NOTIFY_EMAIL');
        if ($adminEmail) {
            Mailer::send($adminEmail, 'Comprovativo submetido', 'O cliente ' . $user['email'] . ' submeteu comprovativo da fatura #' . $invoiceId);
        }
        Response::json(['message' => 'Comprovativo enviado']);
    }

    public static function index(): void
    {
        $user = Auth::requireUser();
        $orders = Order::listForUser($user['id']);
        Response::json(['orders' => $orders]);
    }

    public static function deliveries(): void
    {
        $user = Auth::requireUser();
        $orders = Order::listForUser($user['id']);
        $deliverables = array_values(array_filter($orders, fn($o) => !empty($o['final_file'])));
        Response::json(['documents' => $deliverables]);
    }

    public static function feedback(): void
    {
        $user = Auth::requireUser();
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        if (empty($data['order_id']) || empty($data['rating'])) {
            Response::json(['message' => 'Feedback incompleto'], 400);
            return;
        }
        $order = Order::findWithInvoice((int) $data['order_id']);
        if (!$order || $order['user_id'] !== $user['id']) {
            Response::json(['message' => 'Encomenda inválida'], 404);
            return;
        }
        Feedback::create([
            'order_id' => (int) $data['order_id'],
            'user_id' => $user['id'],
            'rating' => (int) $data['rating'],
            'grade' => $data['grade'] ?? null,
            'comment' => $data['comment'] ?? null,
        ]);
        AuditHelper::log($user['id'], 'feedback:create', ['order_id' => $data['order_id']]);
        Response::json(['message' => 'Feedback registado']);
    }

    public static function affiliateSummary(): void
    {
        $user = Auth::requireUser();
        $code = $user['referral_code'] ?? null;
        if (!$code) {
            Response::json(['commissions' => [], 'totals' => ['pending' => 0, 'approved' => 0, 'paid' => 0], 'payouts' => []]);
            return;
        }
        $commissions = AffiliateCommission::listForCode($code);
        $totals = AffiliateCommission::totalsForCode($code);
        $payouts = AffiliatePayout::listForUser($user['id']);
        Response::json(['commissions' => $commissions, 'totals' => $totals, 'payouts' => $payouts, 'code' => $code]);
    }

    public static function requestPayout(): void
    {
        $user = Auth::requireUser();
        $code = $user['referral_code'] ?? null;
        if (!$code) {
            Response::json(['message' => 'Não existe código de afiliado'], 400);
            return;
        }
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $metodo = $body['metodo'] ?? 'mpesa';
        $notes = $body['notes'] ?? null;
        $available = AffiliateCommission::totalAvailableForCode($code);
        if ($available <= 0) {
            Response::json(['message' => 'Sem saldo disponível para levantamento'], 400);
            return;
        }
        $payoutId = AffiliatePayout::create($user['id'], $available, 'SOLICITADO', $metodo, $notes);
        AuditHelper::log($user['id'], 'affiliate:payout', ['payout_id' => $payoutId, 'valor' => $available]);
        Mailer::send($user['email'], 'Pedido de levantamento recebido', 'Solicitação #' . $payoutId . ' no valor de ' . $available . ' MZN.');
        $adminEmail = Config::get('ADMIN_NOTIFY_EMAIL');
        if ($adminEmail) {
            Mailer::send($adminEmail, 'Novo levantamento de afiliado', 'O afiliado ' . $user['email'] . ' solicitou ' . $available . ' MZN.');
        }
        Response::json(['message' => 'Pedido registado', 'payout_id' => $payoutId]);
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
        $feedback = Feedback::listForOrder($orderId);
        Response::json(['order' => $order, 'feedback' => $feedback]);
    }
}
