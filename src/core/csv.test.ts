import { describe, expect, it } from 'vitest';
import { exportCsv, importTransactions, parseCsv, prepareImport } from './csv';
import { NOW, makeData, makeTx } from './testing';
import type { MutationContext } from './types';

const HEADER = 'date,amount,category,note,paidBy,createdBy';

function setup() {
  const { data, a, b } = makeData();
  data.transactions = [
    makeTx({ id: 't1', date: '2026-10-05', amount: 12500, paidBy: a, note: 'Siêu thị, Aeon' }),
    makeTx({
      id: 't2',
      date: '2026-09-30',
      amount: 800,
      paidBy: b,
      categoryId: 'cat-dining',
      createdBy: b,
    }),
    makeTx({ id: 't3', date: '2026-10-02', amount: 100, paidBy: a, deleted: true }),
    makeTx({ id: 't4', date: '2026-10-01', amount: 300, paidBy: b, note: '=SUM(A1)' }),
  ];
  const ctx: MutationContext = { data, userId: a, now: NOW };
  return { data, a, b, ctx };
}

describe('exportCsv', () => {
  it('UTF-8 có BOM, tên thay cho id, bỏ khoản đã xóa, cũ nhất trước', () => {
    const { data } = setup();
    const csv = exportCsv(data, '2026-09', '2026-10');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual([
      HEADER,
      '2026-09-30,800,Ăn ngoài,,Bình,Bình',
      "2026-10-01,300,Siêu thị / Thực phẩm,'=SUM(A1),Bình,Bình",
      '2026-10-05,12500,Siêu thị / Thực phẩm,"Siêu thị, Aeon",An,An',
      '',
    ]);
  });

  it('chỉ lấy các tháng trong khoảng', () => {
    const { data } = setup();
    const lines = exportCsv(data, '2026-10', '2026-10').trim().split('\r\n');
    expect(lines).toHaveLength(3);
  });
});

describe('parseCsv', () => {
  it('ô trong ngoặc kép chứa dấu phẩy, ngoặc kép và xuống dòng', () => {
    const rows = parseCsv('a,b\r\n"x, y","say ""hi""\nline 2"\r\n\r\nlast,1');
    expect(rows).toEqual([
      { line: 1, fields: ['a', 'b'] },
      { line: 2, fields: ['x, y', 'say "hi"\nline 2'] },
      { line: 5, fields: ['last', '1'] },
    ]);
  });

  it('nhận dấu ; làm dấu phân cách', () => {
    expect(parseCsv('date;amount\n2026-10-01;100')[1]?.fields).toEqual(['2026-10-01', '100']);
  });
});

describe('prepareImport', () => {
  it('export rồi import lại → mọi dòng đều trùng, không nhập thêm gì', () => {
    const { data, ctx } = setup();
    const preview = prepareImport(exportCsv(data, '2026-10', '2026-10'), ctx);
    expect(preview).toMatchObject({ newCount: 0, duplicateCount: 2, errorCount: 0 });
  });

  it('đọc dòng mới, nhận nhiều cách viết ngày và số tiền', () => {
    const { ctx, a, b } = setup();
    const csv = [
      HEADER,
      '2026/10/7,"¥1,200",siêu thị / thực phẩm,Chợ,bình,',
      '2026-10-08,3000円,Ăn ngoài,,An,Bình',
    ].join('\n');
    const preview = prepareImport(csv, ctx);
    expect(preview.newCount).toBe(2);
    expect(preview.rows).toEqual([
      {
        line: 2,
        status: 'new',
        input: {
          date: '2026-10-07',
          amount: 1200,
          categoryId: 'cat-grocery',
          note: 'Chợ',
          paidBy: b,
        },
        createdBy: a,
      },
      {
        line: 3,
        status: 'new',
        input: { date: '2026-10-08', amount: 3000, categoryId: 'cat-dining', note: '', paidBy: a },
        createdBy: b,
      },
    ]);
  });

  it('báo lỗi từng dòng kèm số dòng', () => {
    const { ctx } = setup();
    const csv = [
      HEADER,
      '05/10/2026,100,Khác,,An,',
      '2026-10-05,-5,Khác,,An,',
      '2026-10-05,100,Học phí,,An,',
      '2026-10-05,100,Khác,,Chi,',
      '2026-09-15,100,Khác,,An,',
    ].join('\n');
    const errors = prepareImport(csv, ctx).rows.map((r) =>
      r.status === 'error' ? `${r.line}: ${r.message}` : r.status,
    );
    expect(errors).toEqual([
      expect.stringMatching(/^2: Ngày không hợp lệ/),
      expect.stringMatching(/^3: Số tiền không hợp lệ/),
      expect.stringMatching(/^4: Không có danh mục "Học phí"/),
      expect.stringMatching(/^5: Không có người dùng "Chi"/),
      expect.stringMatching(/^6: Tháng 9\/2026 đã khóa/),
    ]);
  });

  it('dòng trùng nhau trong cùng file chỉ nhập một lần', () => {
    const { ctx } = setup();
    const row = '2026-10-10,500,Khác,Cà phê,An,';
    const preview = prepareImport([HEADER, row, row].join('\n'), ctx);
    expect(preview.rows.map((r) => r.status)).toEqual(['new', 'duplicate']);
  });

  it("bỏ dấu ' chống công thức khi import", () => {
    const { ctx } = setup();
    const preview = prepareImport(`${HEADER}\n2026-10-10,500,Khác,'=1+1,An,`, ctx);
    expect(preview.rows[0]).toMatchObject({ input: { note: '=1+1' } });
  });

  it('thiếu cột bắt buộc hoặc file rỗng → lỗi cả file', () => {
    const { ctx } = setup();
    expect(() => prepareImport('date,amount\n2026-10-01,100', ctx)).toThrow('thiếu cột');
    expect(() => prepareImport('', ctx)).toThrow('rỗng');
  });
});

describe('importTransactions', () => {
  it('tạo khoản chi mới, người nhập theo cột createdBy, người sửa là người import', () => {
    const { ctx, a, b } = setup();
    const preview = prepareImport(`${HEADER}\n2026-10-10,500,Khác,Cà phê,An,Bình`, ctx);
    let n = 0;
    const [tx, ...rest] = importTransactions(preview, ctx, () => `new-${++n}`);
    expect(rest).toEqual([]);
    expect(tx).toMatchObject({
      id: 'new-1',
      date: '2026-10-10',
      amount: 500,
      categoryId: 'cat-other',
      note: 'Cà phê',
      paidBy: a,
      createdBy: b,
      updatedBy: a,
      deleted: false,
    });
  });
});
