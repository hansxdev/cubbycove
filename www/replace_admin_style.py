import os

files_to_update = ['staff/admin_dashboard.html', 'creator/creator.html']

replacements = {
    'bg-cubby-dark': 'bg-[#0A2540]',
    'text-cubby-blue': 'text-[#635BFF]',
    'bg-cubby-blue': 'bg-[#635BFF]',
    'border-cubby-blue': 'border-[#635BFF]',
    'border-l-4 border-cubby-blue': 'border-l-4 border-[#635BFF]',
    'ring-cubby-blue': 'ring-[#635BFF]',
    'text-cubby-purple': 'text-[#0A2540]',
    'bg-cubby-purple': 'bg-[#0A2540]',
    'border-cubby-purple': 'border-[#0A2540]',
    'rounded-2xl': 'rounded-xl',
    'rounded-xl': 'rounded-lg',
    'bg-gray-100': 'bg-[#F7F9FC]',
    'shadow-sm': 'shadow-[0_2px_5px_rgba(0,0,0,0.04)] border border-gray-200',
    'bg-purple-50': 'bg-slate-50',
    'bg-blue-50': 'bg-indigo-50'
}

for file_path in files_to_update:
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        for old, new in replacements.items():
            content = content.replace(old, new)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Updated {file_path}')
    else:
        print(f'File not found: {file_path}')
