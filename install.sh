#!/bin/bash

#############################################################
#  GatePass - Guided Installation Script
#  Supports: Ubuntu/Debian, Fedora, Arch Linux
#
#  This script will guide you through installing GatePass
#  on your system with minimal technical knowledge required.
#############################################################

set -e

# Colors for pretty output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Installation directory
INSTALL_DIR="$HOME/gatepass"
LOG_FILE="$INSTALL_DIR/install.log"

#############################################################
# Helper Functions
#############################################################

print_banner() {
    clear
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║     ██████╗  █████╗ ████████╗███████╗██████╗  █████╗ ███████╗███████╗  ║"
    echo "║    ██╔════╝ ██╔══██╗╚══██╔══╝██╔════╝██╔══██╗██╔══██╗██╔════╝██╔════╝  ║"
    echo "║    ██║  ███╗███████║   ██║   █████╗  ██████╔╝███████║███████╗███████╗  ║"
    echo "║    ██║   ██║██╔══██║   ██║   ██╔══╝  ██╔═══╝ ██╔══██║╚════██║╚════██║  ║"
    echo "║    ╚██████╔╝██║  ██║   ██║   ███████╗██║     ██║  ██║███████║███████║  ║"
    echo "║     ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝     ╚═╝  ╚═╝╚══════╝╚══════╝  ║"
    echo "║                                                           ║"
    echo "║           Business Center Access Control System           ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
}

print_step() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${PURPLE}📌 STEP $1: $2${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_progress() {
    echo -e "${PURPLE}⏳ $1${NC}"
}

press_enter() {
    echo ""
    echo -e "${YELLOW}Press ENTER to continue...${NC}"
    read -r
}

ask_yes_no() {
    while true; do
        echo -e "${CYAN}$1 (y/n): ${NC}"
        read -r answer
        case $answer in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer y or n.";;
        esac
    done
}

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

#############################################################
# System Detection
#############################################################

detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO=$ID
        DISTRO_VERSION=$VERSION_ID
        DISTRO_NAME=$PRETTY_NAME
    elif [ -f /etc/lsb-release ]; then
        . /etc/lsb-release
        DISTRO=$DISTRIB_ID
        DISTRO_VERSION=$DISTRIB_RELEASE
        DISTRO_NAME=$DISTRIB_DESCRIPTION
    else
        DISTRO="unknown"
        DISTRO_NAME="Unknown Distribution"
    fi

    # Normalize distro names
    case $DISTRO in
        ubuntu|debian|linuxmint|pop|elementary|zorin)
            DISTRO_FAMILY="debian"
            PKG_MANAGER="apt"
            ;;
        fedora|rhel|centos|rocky|alma)
            DISTRO_FAMILY="fedora"
            PKG_MANAGER="dnf"
            ;;
        arch|manjaro|endeavouros|garuda)
            DISTRO_FAMILY="arch"
            PKG_MANAGER="pacman"
            ;;
        *)
            DISTRO_FAMILY="unknown"
            PKG_MANAGER="unknown"
            ;;
    esac
}

check_requirements() {
    print_step "1" "Checking System Requirements"

    echo -e "${BOLD}Detected System:${NC}"
    echo -e "  • Distribution: ${GREEN}$DISTRO_NAME${NC}"
    echo -e "  • Package Manager: ${GREEN}$PKG_MANAGER${NC}"
    echo ""

    # Check minimum requirements
    local errors=0

    # RAM check (minimum 2GB)
    total_ram=$(free -m | awk '/^Mem:/{print $2}')
    if [ "$total_ram" -ge 2048 ]; then
        echo -e "  • RAM: ${GREEN}${total_ram}MB (OK - minimum 2GB)${NC}"
    else
        echo -e "  • RAM: ${RED}${total_ram}MB (WARNING - 2GB recommended)${NC}"
    fi

    # Disk space check (minimum 5GB)
    free_space=$(df -BG "$HOME" | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$free_space" -ge 5 ]; then
        echo -e "  • Disk Space: ${GREEN}${free_space}GB available (OK)${NC}"
    else
        echo -e "  • Disk Space: ${RED}${free_space}GB available (Need 5GB minimum)${NC}"
        errors=$((errors + 1))
    fi

    # Internet connectivity
    if ping -c 1 github.com &> /dev/null; then
        echo -e "  • Internet: ${GREEN}Connected${NC}"
    else
        echo -e "  • Internet: ${RED}Not connected${NC}"
        errors=$((errors + 1))
    fi

    echo ""

    if [ $errors -gt 0 ]; then
        print_error "System requirements not met. Please fix the issues above."
        exit 1
    fi

    print_success "System requirements check passed!"
    log "System check passed: $DISTRO_NAME"
}

#############################################################
# Installation Functions by Distro
#############################################################

install_dependencies_debian() {
    print_progress "Updating package lists..."
    sudo apt update >> "$LOG_FILE" 2>&1

    print_progress "Installing system dependencies..."
    sudo apt install -y \
        git curl wget \
        python3 python3-pip python3-venv \
        postgresql postgresql-contrib \
        redis-server \
        nodejs npm \
        nginx \
        >> "$LOG_FILE" 2>&1

    print_success "Dependencies installed successfully!"
}

install_dependencies_fedora() {
    print_progress "Updating package lists..."
    sudo dnf check-update >> "$LOG_FILE" 2>&1 || true

    print_progress "Installing system dependencies..."
    sudo dnf install -y \
        git curl wget \
        python3 python3-pip python3-virtualenv \
        postgresql postgresql-server postgresql-contrib \
        redis \
        nodejs npm \
        nginx \
        >> "$LOG_FILE" 2>&1

    # Initialize PostgreSQL on Fedora
    sudo postgresql-setup --initdb >> "$LOG_FILE" 2>&1 || true

    print_success "Dependencies installed successfully!"
}

install_dependencies_arch() {
    print_progress "Updating package lists..."
    sudo pacman -Sy --noconfirm >> "$LOG_FILE" 2>&1

    print_progress "Installing system dependencies..."
    sudo pacman -S --noconfirm \
        git curl wget \
        python python-pip python-virtualenv \
        postgresql \
        redis \
        nodejs npm \
        nginx \
        >> "$LOG_FILE" 2>&1

    # Initialize PostgreSQL on Arch
    sudo -u postgres initdb -D /var/lib/postgres/data >> "$LOG_FILE" 2>&1 || true

    print_success "Dependencies installed successfully!"
}

install_dependencies() {
    print_step "2" "Installing System Dependencies"

    echo "This step will install the following software:"
    echo ""
    echo -e "  ${CYAN}• Git${NC} - For downloading the source code"
    echo -e "  ${CYAN}• Python 3${NC} - For running the backend server"
    echo -e "  ${CYAN}• PostgreSQL${NC} - Database for storing data"
    echo -e "  ${CYAN}• Redis${NC} - For background tasks and caching"
    echo -e "  ${CYAN}• Node.js & npm${NC} - For the frontend application"
    echo -e "  ${CYAN}• Nginx${NC} - Web server (for production)"
    echo ""

    print_warning "You may be asked for your password (sudo access required)"
    press_enter

    case $DISTRO_FAMILY in
        debian)
            install_dependencies_debian
            ;;
        fedora)
            install_dependencies_fedora
            ;;
        arch)
            install_dependencies_arch
            ;;
        *)
            print_error "Unsupported distribution: $DISTRO"
            echo "Please install dependencies manually. See docs/MANUAL_INSTALL.md"
            exit 1
            ;;
    esac

    log "Dependencies installed for $DISTRO_FAMILY"
}

#############################################################
# Service Setup
#############################################################

setup_postgresql() {
    print_step "3" "Setting Up PostgreSQL Database"

    echo "PostgreSQL is the database that stores all GatePass data."
    echo "We'll create a dedicated database and user for GatePass."
    echo ""

    # Start PostgreSQL service
    print_progress "Starting PostgreSQL service..."
    case $DISTRO_FAMILY in
        debian)
            sudo systemctl start postgresql
            sudo systemctl enable postgresql
            ;;
        fedora)
            sudo systemctl start postgresql
            sudo systemctl enable postgresql
            ;;
        arch)
            sudo systemctl start postgresql
            sudo systemctl enable postgresql
            ;;
    esac

    sleep 2  # Give PostgreSQL time to start

    # Create database and user
    print_progress "Creating database and user..."

    # Generate a random password
    DB_PASSWORD=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 16)

    sudo -u postgres psql << EOF >> "$LOG_FILE" 2>&1
CREATE USER gatepass WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE gatepass OWNER gatepass;
GRANT ALL PRIVILEGES ON DATABASE gatepass TO gatepass;
EOF

    # Save credentials
    echo "DB_PASSWORD=$DB_PASSWORD" > "$INSTALL_DIR/.db_credentials"
    chmod 600 "$INSTALL_DIR/.db_credentials"

    print_success "PostgreSQL database created!"
    echo ""
    echo -e "  Database: ${GREEN}gatepass${NC}"
    echo -e "  Username: ${GREEN}gatepass${NC}"
    echo -e "  Password: ${GREEN}(saved securely)${NC}"

    log "PostgreSQL setup complete"
}

setup_redis() {
    print_step "4" "Setting Up Redis"

    echo "Redis handles background tasks like sending notifications."
    echo ""

    print_progress "Starting Redis service..."
    sudo systemctl start redis 2>/dev/null || sudo systemctl start redis-server 2>/dev/null
    sudo systemctl enable redis 2>/dev/null || sudo systemctl enable redis-server 2>/dev/null

    # Verify Redis is running
    if redis-cli ping > /dev/null 2>&1; then
        print_success "Redis is running!"
    else
        print_warning "Redis may not be running. Will continue anyway."
    fi

    log "Redis setup complete"
}

#############################################################
# Application Setup
#############################################################

download_application() {
    print_step "5" "Downloading GatePass Application"

    echo "Downloading the latest version from GitHub..."
    echo ""

    if [ -d "$INSTALL_DIR/.git" ]; then
        print_info "GatePass directory exists. Updating..."
        cd "$INSTALL_DIR"
        git pull origin main >> "$LOG_FILE" 2>&1
    else
        print_progress "Cloning repository..."
        git clone https://github.com/kaleaditya28897-linux/gatepass.git "$INSTALL_DIR" >> "$LOG_FILE" 2>&1
    fi

    cd "$INSTALL_DIR"
    print_success "GatePass downloaded to: $INSTALL_DIR"

    log "Application downloaded"
}

setup_backend() {
    print_step "6" "Setting Up Backend (Django)"

    echo "The backend is the server that handles all the business logic."
    echo ""

    cd "$INSTALL_DIR/backend"

    # Create virtual environment
    print_progress "Creating Python virtual environment..."
    python3 -m venv venv >> "$LOG_FILE" 2>&1

    # Activate virtual environment
    source venv/bin/activate

    # Install dependencies
    print_progress "Installing Python packages (this may take a few minutes)..."
    pip install --upgrade pip >> "$LOG_FILE" 2>&1
    pip install -r requirements.txt >> "$LOG_FILE" 2>&1

    # Load database password
    source "$INSTALL_DIR/.db_credentials"

    # Create .env file
    print_progress "Creating configuration file..."
    cat > "$INSTALL_DIR/backend/.env" << EOF
# Django Settings
SECRET_KEY=$(openssl rand -base64 32)
DJANGO_SETTINGS_MODULE=gatepass.settings.development

# Database
DB_NAME=gatepass
DB_USER=gatepass
DB_PASSWORD=$DB_PASSWORD
DB_HOST=localhost
DB_PORT=5432

# Redis
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# Frontend URL (for QR code links)
FRONTEND_URL=http://localhost:5173

# Notifications (console mode for development)
SMS_BACKEND=console
EOF

    # Run migrations
    print_progress "Setting up database tables..."
    python manage.py migrate >> "$LOG_FILE" 2>&1

    # Create superuser
    print_progress "Creating admin account..."
    python manage.py create_admin >> "$LOG_FILE" 2>&1

    print_success "Backend setup complete!"

    deactivate
    log "Backend setup complete"
}

setup_frontend() {
    print_step "7" "Setting Up Frontend (React)"

    echo "The frontend is the web interface you'll interact with."
    echo ""

    cd "$INSTALL_DIR/frontend"

    # Install Node.js dependencies
    print_progress "Installing frontend packages (this may take a few minutes)..."
    npm install >> "$LOG_FILE" 2>&1

    # Create .env.local
    print_progress "Creating frontend configuration..."
    cat > "$INSTALL_DIR/frontend/.env.local" << EOF
VITE_API_URL=http://localhost:8000/api/v1
EOF

    print_success "Frontend setup complete!"

    log "Frontend setup complete"
}

load_demo_data() {
    print_step "8" "Loading Demo Data (Optional)"

    echo "Would you like to load sample data to explore GatePass?"
    echo ""
    echo "This includes:"
    echo "  • 2 sample companies (TechCorp, DesignHub)"
    echo "  • 5 sample employees"
    echo "  • 2 security guards"
    echo "  • 3 gates"
    echo "  • Sample visitor passes and deliveries"
    echo ""

    if ask_yes_no "Load demo data?"; then
        cd "$INSTALL_DIR/backend"
        source venv/bin/activate

        print_progress "Loading demo data..."
        python manage.py seed_demo_data >> "$LOG_FILE" 2>&1

        deactivate
        print_success "Demo data loaded!"
    else
        print_info "Skipping demo data."
    fi

    log "Demo data step complete"
}

#############################################################
# Service Scripts
#############################################################

create_startup_scripts() {
    print_step "9" "Creating Startup Scripts"

    echo "Creating convenient scripts to start/stop GatePass..."
    echo ""

    # Start script
    cat > "$INSTALL_DIR/start.sh" << 'EOF'
#!/bin/bash

# GatePass Start Script
INSTALL_DIR="$(dirname "$(readlink -f "$0")")"

echo "🚀 Starting GatePass..."

# Start backend
echo "Starting backend server..."
cd "$INSTALL_DIR/backend"
source venv/bin/activate
python manage.py runserver 0.0.0.0:8000 &
BACKEND_PID=$!
echo $BACKEND_PID > "$INSTALL_DIR/.backend.pid"

# Start Celery worker
echo "Starting background worker..."
celery -A gatepass worker --loglevel=info &
CELERY_PID=$!
echo $CELERY_PID > "$INSTALL_DIR/.celery.pid"

deactivate

# Start frontend
echo "Starting frontend..."
cd "$INSTALL_DIR/frontend"
npm run dev &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$INSTALL_DIR/.frontend.pid"

echo ""
echo "✅ GatePass is running!"
echo ""
echo "📱 Access the application at:"
echo "   Frontend: http://localhost:5173"
echo "   Backend API: http://localhost:8000/api/v1/"
echo ""
echo "🔑 Login credentials:"
echo "   Admin: admin / admin123"
echo ""
echo "To stop GatePass, run: ./stop.sh"
echo ""

# Wait for any process to exit
wait
EOF
    chmod +x "$INSTALL_DIR/start.sh"

    # Stop script
    cat > "$INSTALL_DIR/stop.sh" << 'EOF'
#!/bin/bash

# GatePass Stop Script
INSTALL_DIR="$(dirname "$(readlink -f "$0")")"

echo "🛑 Stopping GatePass..."

# Stop backend
if [ -f "$INSTALL_DIR/.backend.pid" ]; then
    kill $(cat "$INSTALL_DIR/.backend.pid") 2>/dev/null
    rm "$INSTALL_DIR/.backend.pid"
    echo "Backend stopped."
fi

# Stop Celery
if [ -f "$INSTALL_DIR/.celery.pid" ]; then
    kill $(cat "$INSTALL_DIR/.celery.pid") 2>/dev/null
    rm "$INSTALL_DIR/.celery.pid"
    echo "Celery stopped."
fi

# Stop frontend
if [ -f "$INSTALL_DIR/.frontend.pid" ]; then
    kill $(cat "$INSTALL_DIR/.frontend.pid") 2>/dev/null
    rm "$INSTALL_DIR/.frontend.pid"
    echo "Frontend stopped."
fi

# Kill any remaining processes
pkill -f "manage.py runserver" 2>/dev/null
pkill -f "celery.*gatepass" 2>/dev/null
pkill -f "vite" 2>/dev/null

echo "✅ GatePass stopped."
EOF
    chmod +x "$INSTALL_DIR/stop.sh"

    # Status script
    cat > "$INSTALL_DIR/status.sh" << 'EOF'
#!/bin/bash

# GatePass Status Script
echo "📊 GatePass Status"
echo "=================="
echo ""

# Check backend
if curl -s http://localhost:8000/api/v1/auth/me/ > /dev/null 2>&1; then
    echo "✅ Backend: Running (http://localhost:8000)"
else
    echo "❌ Backend: Not running"
fi

# Check frontend
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "✅ Frontend: Running (http://localhost:5173)"
else
    echo "❌ Frontend: Not running"
fi

# Check PostgreSQL
if systemctl is-active --quiet postgresql 2>/dev/null; then
    echo "✅ PostgreSQL: Running"
else
    echo "❌ PostgreSQL: Not running"
fi

# Check Redis
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis: Running"
else
    echo "❌ Redis: Not running"
fi

echo ""
EOF
    chmod +x "$INSTALL_DIR/status.sh"

    print_success "Startup scripts created!"
    echo ""
    echo "  • start.sh  - Start GatePass"
    echo "  • stop.sh   - Stop GatePass"
    echo "  • status.sh - Check status"

    log "Startup scripts created"
}

#############################################################
# Completion
#############################################################

print_completion() {
    echo ""
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║        🎉 INSTALLATION COMPLETE! 🎉                       ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo -e "${BOLD}GatePass has been installed successfully!${NC}"
    echo ""
    echo -e "${CYAN}📁 Installation Directory:${NC}"
    echo "   $INSTALL_DIR"
    echo ""
    echo -e "${CYAN}🚀 To Start GatePass:${NC}"
    echo "   cd $INSTALL_DIR"
    echo "   ./start.sh"
    echo ""
    echo -e "${CYAN}🌐 Access URLs:${NC}"
    echo "   Frontend:  http://localhost:5173"
    echo "   Admin:     http://localhost:8000/admin/"
    echo "   API:       http://localhost:8000/api/v1/"
    echo ""
    echo -e "${CYAN}🔑 Default Login Credentials:${NC}"
    echo "   ┌─────────────────┬──────────────────┬──────────────┐"
    echo "   │ Role            │ Username         │ Password     │"
    echo "   ├─────────────────┼──────────────────┼──────────────┤"
    echo "   │ Admin           │ admin            │ admin123     │"
    echo "   │ Company Admin   │ techcorp_admin   │ password123  │"
    echo "   │ Employee        │ amit.kumar       │ password123  │"
    echo "   │ Guard           │ guard.raju       │ password123  │"
    echo "   └─────────────────┴──────────────────┴──────────────┘"
    echo ""
    echo -e "${CYAN}📖 Documentation:${NC}"
    echo "   $INSTALL_DIR/docs/"
    echo ""
    echo -e "${CYAN}📋 Log File:${NC}"
    echo "   $LOG_FILE"
    echo ""
    echo -e "${YELLOW}⚠️  For production deployment, please see:${NC}"
    echo "   $INSTALL_DIR/docs/PRODUCTION.md"
    echo ""

    log "Installation complete"
}

#############################################################
# Main Installation Flow
#############################################################

main() {
    # Create install directory and log file
    mkdir -p "$INSTALL_DIR"
    touch "$LOG_FILE"

    print_banner

    echo -e "${BOLD}Welcome to the GatePass Installation Wizard!${NC}"
    echo ""
    echo "This script will guide you through installing GatePass on your system."
    echo "The process typically takes 5-10 minutes depending on your internet speed."
    echo ""
    echo -e "${CYAN}What will be installed:${NC}"
    echo "  • PostgreSQL database"
    echo "  • Redis server"
    echo "  • Python backend (Django)"
    echo "  • React frontend"
    echo ""

    if ! ask_yes_no "Ready to begin installation?"; then
        echo "Installation cancelled."
        exit 0
    fi

    log "Installation started"

    # Detect distribution
    detect_distro

    # Run installation steps
    check_requirements
    press_enter

    install_dependencies
    press_enter

    setup_postgresql
    press_enter

    setup_redis
    press_enter

    download_application
    press_enter

    setup_backend
    press_enter

    setup_frontend
    press_enter

    load_demo_data
    press_enter

    create_startup_scripts

    print_completion

    # Offer to start immediately
    echo ""
    if ask_yes_no "Would you like to start GatePass now?"; then
        cd "$INSTALL_DIR"
        ./start.sh
    fi
}

# Run main function
main "$@"
