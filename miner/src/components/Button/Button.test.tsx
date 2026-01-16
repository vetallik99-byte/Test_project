import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Button from './Button';

describe('Button keyboard activation', () => {
  test('Space sets data-active on keydown, clicks on keyup, then clears', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Press me</Button>);
    const btn = screen.getByRole('button', { name: /press me/i });

    btn.focus();
    expect(btn).toHaveFocus();

    fireEvent.keyDown(btn, { key: ' ' });
    expect(btn).toHaveAttribute('data-active', 'true');

    fireEvent.keyUp(btn, { key: ' ' });
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(btn).not.toHaveAttribute('data-active');
  });

  test('Enter sets data-active on keydown, clicks immediately, clears on keyup', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Go</Button>);
    const btn = screen.getByRole('button', { name: /go/i });

    btn.focus();

    fireEvent.keyDown(btn, { key: 'Enter' });
    expect(btn).toHaveAttribute('data-active', 'true');
    expect(handleClick).toHaveBeenCalledTimes(1);

    fireEvent.keyUp(btn, { key: 'Enter' });
    expect(btn).not.toHaveAttribute('data-active');
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('Disabled button ignores keyboard', () => {
    const handleClick = jest.fn();
    render(
      <Button onClick={handleClick} disabled>
        Disabled
      </Button>,
    );
    const btn = screen.getByRole('button', { name: /disabled/i });

    fireEvent.keyDown(btn, { key: ' ' });
    fireEvent.keyUp(btn, { key: ' ' });
    fireEvent.keyDown(btn, { key: 'Enter' });
    fireEvent.keyUp(btn, { key: 'Enter' });

    expect(btn).not.toHaveAttribute('data-active');
    expect(handleClick).not.toHaveBeenCalled();
  });
});

